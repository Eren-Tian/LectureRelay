use crate::error::{AppResult, UserFacing};
use cpal::{
    FromSample, Sample, SizedSample,
    traits::{DeviceTrait, HostTrait},
};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
    mpsc,
};

#[derive(Default)]
pub(super) struct CaptureHealth {
    dropped_buffers: AtomicU32,
    dropped_samples: AtomicU64,
    discontinuities: AtomicU32,
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureQuality {
    pub dropped_buffers: u32,
    pub dropped_samples: u64,
    pub device_discontinuities: u32,
}

impl CaptureHealth {
    pub fn snapshot(&self) -> CaptureQuality {
        CaptureQuality {
            dropped_buffers: self.dropped_buffers.load(Ordering::Relaxed),
            dropped_samples: self.dropped_samples.load(Ordering::Relaxed),
            device_discontinuities: self.discontinuities.load(Ordering::Relaxed),
        }
    }
}
impl CaptureQuality {
    pub fn total_events(&self) -> u32 {
        self.dropped_buffers
            .saturating_add(self.device_discontinuities)
    }
    pub fn warning(&self) -> Option<String> {
        if self.dropped_buffers > 0 {
            Some(format!(
                "Recording could not keep up: {} audio buffers ({} samples) were lost. Check the saved recording.",
                self.dropped_buffers, self.dropped_samples
            ))
        } else if self.device_discontinuities > 0 {
            Some("The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected.".into())
        } else {
            None
        }
    }
}

fn send_samples(sender: &mpsc::SyncSender<Vec<i16>>, samples: Vec<i16>, health: &CaptureHealth) {
    if let Err(mpsc::TrySendError::Full(samples)) = sender.try_send(samples) {
        health.dropped_buffers.fetch_add(1, Ordering::Relaxed);
        health
            .dropped_samples
            .fetch_add(samples.len() as u64, Ordering::Relaxed);
    }
}

fn stream_error(kind: cpal::ErrorKind, health: &CaptureHealth, failed: &AtomicBool) {
    match kind {
        cpal::ErrorKind::Xrun => {
            health.discontinuities.fetch_add(1, Ordering::Relaxed);
        }
        cpal::ErrorKind::DeviceChanged | cpal::ErrorKind::RealtimeDenied => {}
        _ => failed.store(true, Ordering::Relaxed),
    }
}

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
    health: Arc<CaptureHealth>,
    failed: Arc<AtomicBool>,
) -> AppResult<cpal::Stream>
where
    T: SizedSample + Sample,
    f32: FromSample<T>,
{
    let channels = config.channels as usize;
    if channels == 0 || config.sample_rate == 0 {
        return Err("The audio device returned an invalid format.".into());
    }
    let device_health = health.clone();
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
                send_samples(&sender, mono, &health);
            },
            move |error| {
                // WASAPI reports recoverable discontinuities at stream start/resume.
                // They must not be treated as device loss or terminate the WAV writer.
                stream_error(error.kind(), &device_health, &failed);
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
    use super::*;
    #[test]
    fn device_discontinuities_are_not_reported_as_lost_samples() {
        let health = CaptureHealth::default();
        let failed = AtomicBool::new(false);
        stream_error(cpal::ErrorKind::Xrun, &health, &failed);
        let q = health.snapshot();
        assert_eq!(q.device_discontinuities, 1);
        assert_eq!(q.dropped_samples, 0);
        assert_eq!(q.dropped_buffers, 0);
        assert!(!failed.load(Ordering::Relaxed));
        assert!(q.warning().unwrap().contains("did not report"));
    }
    #[test]
    fn a_full_capture_queue_counts_only_the_samples_it_actually_dropped() {
        let health = CaptureHealth::default();
        let (sender, receiver) = mpsc::sync_channel(1);
        send_samples(&sender, vec![1; 48], &health);
        send_samples(&sender, vec![2; 96], &health);
        assert_eq!(receiver.recv().unwrap(), vec![1; 48]);
        let q = health.snapshot();
        assert_eq!(q.dropped_buffers, 1);
        assert_eq!(q.dropped_samples, 96);
        assert_eq!(q.device_discontinuities, 0);
        drop(receiver);
        send_samples(&sender, vec![3; 48], &health);
        assert_eq!(health.snapshot().dropped_samples, 96);
    }
    #[test]
    fn pcm_conversion_clips_and_handles_invalid_device_samples() {
        assert_eq!(super::float_to_pcm(f32::NAN), 0);
        assert_eq!(super::float_to_pcm(2.0), 32767);
        assert_eq!(super::float_to_pcm(-2.0), -32767);
        assert_eq!(super::float_to_pcm(0.5), 16384);
    }
}
