use super::trace::{CaptureTrace, PacketTiming, signed_delta_us};
use crate::{
    domain::InputSource,
    error::{AppResult, UserFacing},
};
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
    pending_discontinuities: AtomicU32,
    buffered_samples: AtomicU64,
    pub trace: CaptureTrace,
}

pub(super) fn sample_queue() -> (mpsc::SyncSender<Vec<i16>>, mpsc::Receiver<Vec<i16>>) {
    // A separate sample budget bounds PCM memory by time, even when device
    // packet sizes vary. This packet limit also bounds channel/Vec overhead.
    mpsc::sync_channel(8192)
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureQuality {
    pub dropped_buffers: u32,
    pub dropped_samples: u64,
    pub device_discontinuities: u32,
}

impl CaptureHealth {
    pub fn consumed(&self, samples: usize) {
        self.buffered_samples
            .fetch_sub(samples as u64, Ordering::Relaxed);
    }
    fn queue_drop(&self, count: u64) {
        self.trace
            .queue_discarded
            .fetch_add(count, Ordering::Relaxed);
        self.dropped_buffers.fetch_add(1, Ordering::Relaxed);
        self.dropped_samples.fetch_add(count, Ordering::Relaxed);
        self.trace
            .event("application_queue_drop", false, Some(count), None);
    }
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

fn send_samples(
    sender: &mpsc::SyncSender<Vec<i16>>,
    samples: Vec<i16>,
    health: &CaptureHealth,
    rate: u32,
) {
    let count = samples.len() as u64;
    // Reserve before enqueue: the consumer may run immediately after try_send.
    if health
        .buffered_samples
        .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |pending| {
            pending
                .checked_add(count)
                .filter(|next| *next <= u64::from(rate) * 5)
        })
        .is_err()
    {
        health.queue_drop(count);
        return;
    }
    match sender.try_send(samples) {
        Ok(()) => {
            health.trace.queued.fetch_add(count, Ordering::Relaxed);
        }
        Err(mpsc::TrySendError::Full(_)) => {
            health.consumed(count as usize);
            health.queue_drop(count);
        }
        Err(mpsc::TrySendError::Disconnected(_)) => {
            health.consumed(count as usize);
            health
                .trace
                .receiver_discarded
                .fetch_add(count, Ordering::Relaxed);
            health
                .trace
                .event("receiver_closed", false, Some(count), None);
        }
    }
}

impl CaptureHealth {
    /// Recording moved to a replacement device; the saved recording reports the gap.
    pub(super) fn device_switched(&self, paused: bool) {
        self.discontinuities.fetch_add(1, Ordering::Relaxed);
        self.pending_discontinuities.fetch_add(1, Ordering::Relaxed);
        self.trace.event("device_switched", paused, None, None);
    }
}

/// Converts mono PCM between sample rates by linear interpolation, keeping
/// state across packets. Used when a replacement device runs at a different
/// rate than the recording file.
pub(super) struct Resampler {
    step: f64,
    /// Fractional index into the next packet; -1 refers to `previous`.
    position: f64,
    previous: Option<i16>,
}

impl Resampler {
    pub(super) fn new(from: u32, to: u32) -> Self {
        Self {
            step: f64::from(from) / f64::from(to),
            position: 0.0,
            previous: None,
        }
    }

    pub(super) fn process(&mut self, input: &[i16]) -> Vec<i16> {
        let Some(&last) = input.last() else {
            return Vec::new();
        };
        let previous = f64::from(self.previous.unwrap_or(input[0]));
        let sample =
            |index: isize| usize::try_from(index).map_or(previous, |i| f64::from(input[i]));
        let end = (input.len() - 1) as f64;
        let mut output = Vec::with_capacity((input.len() as f64 / self.step) as usize + 1);
        while self.position < end {
            let base = self.position.floor();
            let (a, b) = (sample(base as isize), sample(base as isize + 1));
            output.push((a + (b - a) * (self.position - base)).round() as i16);
            self.position += self.step;
        }
        self.position -= input.len() as f64;
        self.previous = Some(last);
        output
    }
}

fn stream_error(kind: cpal::ErrorKind, health: &CaptureHealth, failed: &AtomicBool, paused: bool) {
    match kind {
        cpal::ErrorKind::Xrun => {
            health.discontinuities.fetch_add(1, Ordering::Relaxed);
            health
                .pending_discontinuities
                .fetch_add(1, Ordering::Relaxed);
            health
                .trace
                .event("device_discontinuity", paused, None, None);
        }
        cpal::ErrorKind::DeviceChanged => health.trace.event("device_changed", paused, None, None),
        cpal::ErrorKind::RealtimeDenied => {
            health.trace.event("realtime_denied", paused, None, None)
        }
        _ => {
            health.trace.event("capture_error", paused, None, None);
            failed.store(true, Ordering::Relaxed);
        }
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
    devices(InputSource::Microphone)
}

pub fn devices(source: InputSource) -> AppResult<Vec<InputDevice>> {
    let host = cpal::default_host();
    let default_id = (if source == InputSource::System {
        host.default_output_device()
    } else {
        host.default_input_device()
    })
    .and_then(|device| device.id().ok())
    .map(|id| id.to_string());
    let devices = (if source == InputSource::System {
        host.output_devices()
    } else {
        host.input_devices()
    })
    .user_error(crate::error::ErrorCode::CannotListAudioDevicesCheckWindowsPermissions)?;
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

fn build_stream<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    output_rate: u32,
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
        return Err(crate::error::ErrorCode::TheAudioDeviceReturnedAnInvalidFormat.into());
    }
    let device_health = health.clone();
    let error_paused = paused.clone();
    let mut first_capture = None;
    let mut previous_capture = None;
    let mut previous_frames = 0_u64;
    let mut last_anchor_us = 0;
    let mut resampler = (config.sample_rate != output_rate)
        .then(|| Resampler::new(config.sample_rate, output_rate));
    device
        .build_input_stream(
            config,
            move |data: &[T], info| {
                let frames = (data.len() / channels) as u64;
                let received_frame_start =
                    health.trace.received.fetch_add(frames, Ordering::Relaxed);
                let timestamp = info.timestamp();
                let first = *first_capture.get_or_insert(timestamp.capture);
                let timing = PacketTiming {
                    received_frame_start,
                    frames,
                    capture_offset_us: signed_delta_us(timestamp.capture, first),
                    callback_delay_us: timestamp
                        .callback
                        .checked_duration_since(timestamp.capture)
                        .map(|d| d.as_micros() as u64),
                    // Retain negative values too: a backend/device timestamp is evidence,
                    // not a guaranteed measurement of end-to-end capture latency.
                    callback_minus_capture_us: signed_delta_us(
                        timestamp.callback,
                        timestamp.capture,
                    ),
                    delta_from_expected_us: previous_capture.map(|previous| {
                        signed_delta_us(timestamp.capture, previous)
                            - (previous_frames * 1_000_000 / config.sample_rate as u64) as i64
                    }),
                };
                let is_paused = paused.load(Ordering::Relaxed);
                if previous_capture.is_none() {
                    health
                        .trace
                        .event("first_packet", is_paused, None, Some(timing));
                }
                if timing
                    .delta_from_expected_us
                    .is_some_and(|d| d.unsigned_abs() > 2000)
                {
                    health
                        .trace
                        .event("capture_timestamp_gap", is_paused, None, Some(timing));
                }
                let discontinuities = health.pending_discontinuities.swap(0, Ordering::Relaxed);
                if discontinuities > 0 {
                    health
                        .trace
                        .event("discontinuity_packet", is_paused, None, Some(timing));
                }
                let now = health.trace.elapsed_us();
                if now.saturating_sub(last_anchor_us) >= 5_000_000 {
                    health
                        .trace
                        .event("capture_anchor", is_paused, None, Some(timing));
                    last_anchor_us = now;
                }
                previous_capture = Some(timestamp.capture);
                previous_frames = frames;
                if is_paused {
                    health
                        .trace
                        .paused_discarded
                        .fetch_add(frames, Ordering::Relaxed);
                    return;
                }
                let mut invalid = 0_u64;
                let mono: Vec<i16> = data
                    .chunks_exact(channels)
                    .map(|frame| {
                        let average = frame
                            .iter()
                            .map(|sample| f32::from_sample(*sample))
                            .sum::<f32>()
                            / channels as f32;
                        if !average.is_finite() {
                            invalid += 1;
                        }
                        float_to_pcm(average)
                    })
                    .collect();
                health
                    .trace
                    .invalid_replaced
                    .fetch_add(invalid, Ordering::Relaxed);
                let mono = match resampler.as_mut() {
                    Some(resampler) => resampler.process(&mono),
                    None => mono,
                };
                send_samples(&sender, mono, &health, output_rate);
            },
            move |error| {
                // WASAPI reports recoverable discontinuities at stream start/resume.
                // They must not be treated as device loss or terminate the WAV writer.
                stream_error(
                    error.kind(),
                    &device_health,
                    &failed,
                    error_paused.load(Ordering::Relaxed),
                );
            },
            None,
        )
        .user_error(crate::error::ErrorCode::CannotStartAudioCaptureCheckWindowsAudioPermissions)
}

/// A capture stream for any supported sample format, delivering mono PCM at
/// `output_rate` (resampled when the device runs at another rate). None when
/// the format is unsupported; callers report that in their own words.
pub(super) fn open_stream(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    output_rate: u32,
    samples: mpsc::SyncSender<Vec<i16>>,
    paused: &Arc<AtomicBool>,
    health: &Arc<CaptureHealth>,
    failed: &Arc<AtomicBool>,
) -> Option<AppResult<cpal::Stream>> {
    let stream_config = config.config();
    let (paused, health, failed) = (paused.clone(), health.clone(), failed.clone());
    Some(match config.sample_format() {
        cpal::SampleFormat::F32 => build_stream::<f32>(
            device,
            stream_config,
            output_rate,
            samples,
            paused,
            health,
            failed,
        ),
        cpal::SampleFormat::I16 => build_stream::<i16>(
            device,
            stream_config,
            output_rate,
            samples,
            paused,
            health,
            failed,
        ),
        cpal::SampleFormat::U16 => build_stream::<u16>(
            device,
            stream_config,
            output_rate,
            samples,
            paused,
            health,
            failed,
        ),
        cpal::SampleFormat::I32 => build_stream::<i32>(
            device,
            stream_config,
            output_rate,
            samples,
            paused,
            health,
            failed,
        ),
        cpal::SampleFormat::F64 => build_stream::<f64>(
            device,
            stream_config,
            output_rate,
            samples,
            paused,
            health,
            failed,
        ),
        _ => return None,
    })
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
    fn resampler_keeps_equal_rates_and_scales_others_across_packets() {
        let ramp: Vec<i16> = (0..480).map(|i| i as i16 * 10).collect();
        // Interpolation needs the next sample, so each packet's last sample
        // comes out with the following packet.
        let mut same = Resampler::new(48_000, 48_000);
        assert_eq!(same.process(&ramp), ramp[..479]);
        assert_eq!(same.process(&[4800, 4810]), [4790, 4800]);
        // 48 kHz to 16 kHz keeps every third sample of a straight line.
        let third = Resampler::new(48_000, 16_000).process(&ramp);
        assert_eq!(third.len(), 160);
        assert!(third.iter().enumerate().all(|(i, s)| *s == (i * 30) as i16));
        // Packet boundaries do not change the result.
        let mut whole = Resampler::new(44_100, 48_000);
        let expected = whole.process(&ramp);
        let mut split = Resampler::new(44_100, 48_000);
        let mut got = split.process(&ramp[..173]);
        got.extend(split.process(&ramp[173..]));
        assert_eq!(got.len(), expected.len());
        assert!(got.iter().zip(&expected).all(|(a, b)| (a - b).abs() <= 1));
        assert!((expected.len() as i64 - 522).abs() <= 1);
        assert!(Resampler::new(44_100, 48_000).process(&[]).is_empty());
    }
    #[test]
    fn capture_preserves_two_seconds_while_writer_is_temporarily_busy() {
        let health = CaptureHealth::default();
        let (sender, receiver) = sample_queue();
        // A known real 48 kHz device supplies 480 frames every 10 ms. Withhold
        // consumer progress to reproduce a two-second filesystem/scheduling stall.
        for packet in 0..200_i16 {
            send_samples(&sender, vec![packet; 480], &health, 48000);
        }
        assert_eq!(health.snapshot().dropped_samples, 0);
        for packet in 0..200_i16 {
            assert_eq!(receiver.try_recv().unwrap(), vec![packet; 480]);
            health.consumed(480);
        }
        assert_eq!(health.buffered_samples.load(Ordering::Relaxed), 0);
    }
    #[test]
    fn capture_queue_budget_is_in_samples_and_releases_consumed_capacity() {
        let health = CaptureHealth::default();
        let (sender, receiver) = sample_queue();
        send_samples(&sender, vec![1; 240000], &health, 48000);
        send_samples(&sender, vec![2; 480], &health, 48000);
        assert_eq!(health.snapshot().dropped_samples, 480);
        let consumed = receiver.try_recv().unwrap();
        health.consumed(consumed.len());
        send_samples(&sender, vec![3; 480], &health, 48000);
        assert_eq!(receiver.try_recv().unwrap(), vec![3; 480]);
        assert_eq!(health.snapshot().dropped_samples, 480);
    }
    #[test]
    fn device_discontinuities_are_not_reported_as_lost_samples() {
        let health = CaptureHealth::default();
        let failed = AtomicBool::new(false);
        stream_error(cpal::ErrorKind::Xrun, &health, &failed, false);
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
        send_samples(&sender, vec![1; 48], &health, 48000);
        send_samples(&sender, vec![2; 96], &health, 48000);
        assert_eq!(receiver.recv().unwrap(), vec![1; 48]);
        let q = health.snapshot();
        assert_eq!(q.dropped_buffers, 1);
        assert_eq!(q.dropped_samples, 96);
        assert_eq!(q.device_discontinuities, 0);
        drop(receiver);
        send_samples(&sender, vec![3; 48], &health, 48000);
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
