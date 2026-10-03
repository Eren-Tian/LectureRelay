use crate::error::{AppResult, UserFacing};
use cpal::{
    FromSample, Sample, SizedSample,
    traits::{DeviceTrait, HostTrait},
};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU32, Ordering},
    mpsc,
};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

pub fn input_devices() -> AppResult<Vec<InputDevice>> {
    devices("microphone")
}

pub fn devices(source: &str) -> AppResult<Vec<InputDevice>> {
    let host = cpal::default_host();
    let default_id = (if source == "system" {
        host.default_output_device()
    } else {
        host.default_input_device()
    })
    .and_then(|device| device.id().ok())
    .map(|id| id.to_string());
    let devices = (if source == "system" {
        host.output_devices()
    } else {
        host.input_devices()
    })
    .user_error("Cannot list audio devices. Check Windows permissions.")?;
    Ok(devices
        .filter_map(|device| {
            let id = device.id().ok()?.to_string();
            Some(InputDevice {
                is_default: default_id.as_deref() == Some(&id),
                id,
                name: device.description().ok()?.name().to_owned(),
            })
        })
        .collect())
}

pub(super) fn build_stream<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    sender: mpsc::SyncSender<Vec<i16>>,
    paused: Arc<AtomicBool>,
    overflow: Arc<AtomicU32>,
    failed: Arc<AtomicBool>,
) -> AppResult<cpal::Stream>
where
    T: SizedSample + Sample,
    f32: FromSample<T>,
{
    let channels = config.channels as usize;
    let device_glitches = overflow.clone();
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                if paused.load(Ordering::Relaxed) {
                    return;
                }
                let mono = data
                    .chunks_exact(channels)
                    .map(|frame| {
                        let average = frame
                            .iter()
                            .map(|sample| f32::from_sample(*sample))
                            .sum::<f32>()
                            / channels as f32;
                        float_to_pcm(average)
                    })
                    .collect();
                if sender.try_send(mono).is_err() {
                    overflow.fetch_add(1, Ordering::Relaxed);
                }
            },
            move |error| {
                // WASAPI reports recoverable discontinuities at stream start/resume.
                // They must not be treated as device loss or terminate the WAV writer.
                if error.kind() == cpal::ErrorKind::Xrun {
                    device_glitches.fetch_add(1, Ordering::Relaxed);
                    return;
                }
                if matches!(
                    error.kind(),
                    cpal::ErrorKind::DeviceChanged | cpal::ErrorKind::RealtimeDenied
                ) {
                    return;
                }
                failed.store(true, Ordering::Relaxed);
            },
            None,
        )
        .user_error(
            "Cannot start audio capture. Check Windows audio permissions or choose another device.",
        )
}

fn float_to_pcm(value: f32) -> i16 {
    if !value.is_finite() {
        return 0;
    }
    (value.clamp(-1.0, 1.0) * 32767.0).round() as i16
}

#[cfg(test)]
mod tests {
    #[test]
    fn pcm_conversion_clips_and_handles_invalid_device_samples() {
        assert_eq!(super::float_to_pcm(f32::NAN), 0);
        assert_eq!(super::float_to_pcm(2.0), 32767);
        assert_eq!(super::float_to_pcm(-2.0), -32767);
        assert_eq!(super::float_to_pcm(0.5), 16384);
    }
}
