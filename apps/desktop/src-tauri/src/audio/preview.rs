use super::capture::build_stream;
use crate::error::{AppResult, UserFacing};
use cpal::{
    SampleFormat,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU32, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewLevel {
    pub id: String,
    pub level: f32,
}

/// Bounded, memory-only capture using the same device path as real recording.
pub fn test(
    app: &tauri::AppHandle,
    id: String,
    source: String,
    device_id: String,
) -> AppResult<f32> {
    let host = cpal::default_host();
    let device = if device_id.is_empty() {
        if source == "system" {
            host.default_output_device()
        } else {
            host.default_input_device()
        }
    } else {
        host.device_by_id(
            &device_id
                .parse()
                .user_error("Invalid audio device. Select it again.")?,
        )
    }
    .ok_or("Audio device unavailable. Connect it and refresh devices.")?;
    let config = (if source == "system" {
        device.default_output_config()
    } else {
        device.default_input_config()
    })
    .user_error("Cannot open this audio input. Check Windows audio permissions.")?;
    let (sender, receiver) = mpsc::sync_channel(64);
    let paused = Arc::new(AtomicBool::new(false));
    let overflow = Arc::new(AtomicU32::new(0));
    let failed = Arc::new(AtomicBool::new(false));
    let stream = match config.sample_format() {
        SampleFormat::F32 => build_stream::<f32>(
            &device,
            config.into(),
            sender,
            paused,
            overflow,
            failed.clone(),
        ),
        SampleFormat::I16 => build_stream::<i16>(
            &device,
            config.into(),
            sender,
            paused,
            overflow,
            failed.clone(),
        ),
        SampleFormat::U16 => build_stream::<u16>(
            &device,
            config.into(),
            sender,
            paused,
            overflow,
            failed.clone(),
        ),
        SampleFormat::I32 => build_stream::<i32>(
            &device,
            config.into(),
            sender,
            paused,
            overflow,
            failed.clone(),
        ),
        SampleFormat::F64 => build_stream::<f64>(
            &device,
            config.into(),
            sender,
            paused,
            overflow,
            failed.clone(),
        ),
        _ => return Err("This audio format is unsupported. Choose another device.".into()),
    }?;
    stream
        .play()
        .user_error("Cannot start the audio test. Close apps holding the device.")?;
    let started = Instant::now();
    let mut event_at = Instant::now();
    let mut peak = 0.0f32;
    let mut level = 0.0f32;
    while started.elapsed() < Duration::from_secs(5) {
        if failed.load(Ordering::Relaxed) {
            return Err("Audio device disconnected during the test.".into());
        }
        if let Ok(samples) = receiver.recv_timeout(Duration::from_millis(50)) {
            for sample in samples {
                level = level.max((sample as f32 / 32768.0).abs());
            }
            peak = peak.max(level);
        }
        if event_at.elapsed() >= Duration::from_millis(100) {
            let _ = app.emit(
                "audio-preview-level",
                PreviewLevel {
                    id: id.clone(),
                    level,
                },
            );
            level = 0.0;
            event_at = Instant::now();
        }
    }
    Ok(peak)
}
