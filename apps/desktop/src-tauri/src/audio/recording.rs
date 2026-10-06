use super::capture::{CaptureHealth, CaptureQuality, build_stream, sample_queue};
use crate::{
    domain::InputSource,
    error::{AppResult, UserFacing},
    storage::write_atomic,
};
use cpal::{
    SampleFormat,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use std::{
    io::BufWriter,
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use tauri::Emitter;

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStatus {
    pub lecture_id: String,
    pub paused: bool,
    pub duration_seconds: f64,
    pub level: f32,
    pub warning: Option<String>,
    pub failed: bool,
    pub dropped_chunks: u32, // Legacy aggregate; use the separate quality fields for attribution.
    pub sample_rate: u32,
    #[serde(flatten)]
    pub quality: CaptureQuality,
    pub source: InputSource,
    pub device_name: String,
}

pub struct AudioSummary {
    pub duration_seconds: f64,
    pub error: Option<String>,
}

pub(crate) fn saved_warning(recording: &std::path::Path) -> Option<String> {
    use std::io::Read;
    let path = recording.parent()?.join("recording-quality.json");
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .ok()?
        .take(16385)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() > 16384 {
        return None;
    }
    let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    value["warning"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 1000)
        .map(str::to_owned)
}

enum Control {
    Pause(bool),
    Stop,
}

struct Session {
    id: String,
    control: mpsc::Sender<Control>,
    paused: Arc<AtomicBool>,
    status: Arc<Mutex<RecordingStatus>>,
    thread: JoinHandle<AppResult<AudioSummary>>,
    health: Arc<CaptureHealth>,
}

#[derive(Default)]
pub struct Recorder(Mutex<Option<Session>>);

impl Recorder {
    pub fn status(&self) -> AppResult<Option<RecordingStatus>> {
        let sessions = self.0.lock().user_error("Recording status unavailable.")?;
        sessions
            .as_ref()
            .map(|session| {
                session
                    .status
                    .lock()
                    .map(|status| status.clone())
                    .user_error("Recording status unavailable.")
            })
            .transpose()
    }

    pub fn start<R: tauri::Runtime>(
        &self,
        app: tauri::AppHandle<R>,
        id: String,
        path: PathBuf,
        recovery: PathBuf,
        device_id: String,
        source: InputSource,
    ) -> AppResult<()> {
        let mut sessions = self.0.lock().user_error("Recording status unavailable.")?;
        if sessions.is_some() {
            return Err("Another lecture is recording. Stop it first.".into());
        }
        let paused = Arc::new(AtomicBool::new(false));
        let status = Arc::new(Mutex::new(RecordingStatus {
            lecture_id: id.clone(),
            ..Default::default()
        }));
        let (control, commands) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::channel();
        let shared_pause = paused.clone();
        let shared_status = status.clone();
        let health = Arc::new(CaptureHealth::default());
        let shared_health = health.clone();
        let thread = thread::Builder::new()
            .name("lecture-recording".into())
            .spawn(move || {
                let result = record(
                    RecordingContext {
                        app,
                        path,
                        recovery,
                        device_id,
                        source,
                        paused: shared_pause,
                        status: shared_status,
                        controls: commands,
                        health: shared_health,
                    },
                    &ready_tx,
                );
                if let Err(ref error) = result {
                    let _ = ready_tx.send(Err(error.clone()));
                }
                result
            })
            .user_error("Cannot start the recording worker.")?;
        match ready_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(())) => {
                *sessions = Some(Session {
                    id,
                    control,
                    paused,
                    status,
                    thread,
                    health,
                });
                Ok(())
            }
            Ok(Err(error)) => {
                let _ = thread.join();
                Err(error)
            }
            Err(_) => {
                let _ = control.send(Control::Stop);
                Err("Audio startup timed out. Check the device and permissions.".into())
            }
        }
    }

    pub fn pause(&self, id: &str, paused: bool) -> AppResult<()> {
        let sessions = self.0.lock().user_error("Recording status unavailable.")?;
        let session = sessions
            .as_ref()
            .filter(|session| session.id == id)
            .ok_or("This lecture is not recording.")?;
        session.paused.store(paused, Ordering::Relaxed);
        session.health.trace.event(
            if paused {
                "pause_requested"
            } else {
                "resume_requested"
            },
            paused,
            None,
            None,
        );
        session
            .control
            .send(Control::Pause(paused))
            .user_error("Recording stopped. Save the lecture.")?;
        Ok(())
    }

    pub fn stop(&self, id: &str) -> AppResult<AudioSummary> {
        let mut sessions = self.0.lock().user_error("Recording status unavailable.")?;
        if sessions.as_ref().is_none_or(|session| session.id != id) {
            return Err("This lecture is not recording.".into());
        }
        let session = sessions.take().ok_or("Recording already stopped.")?;
        session.health.trace.event(
            "stop_requested",
            session.paused.load(Ordering::Relaxed),
            None,
            None,
        );
        let _ = session.control.send(Control::Stop);
        // Keep start/stop serialized until the old stream is closed.
        session
            .thread
            .join()
            .user_error("Recording worker failed. Restart to recover saved audio.")?
    }
}

struct RecordingContext<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
    path: PathBuf,
    recovery: PathBuf,
    device_id: String,
    source: InputSource,
    paused: Arc<AtomicBool>,
    status: Arc<Mutex<RecordingStatus>>,
    controls: mpsc::Receiver<Control>,
    health: Arc<CaptureHealth>,
}

fn record<R: tauri::Runtime>(
    context: RecordingContext<R>,
    ready: &mpsc::Sender<AppResult<()>>,
) -> AppResult<AudioSummary> {
    let RecordingContext {
        app,
        path,
        recovery,
        device_id,
        source,
        paused,
        status,
        controls,
        health,
    } = context;
    let host = cpal::default_host();
    let device = if device_id.is_empty() {
        if source == InputSource::System {
            host.default_output_device()
        } else {
            host.default_input_device()
        }
    } else {
        let device_id = device_id
            .parse()
            .user_error("Invalid audio device. Select it again.")?;
        host.device_by_id(&device_id)
    }
    .ok_or("No audio device found. Connect it and check Windows audio permissions.")?;
    if let Ok(mut current) = status.lock() {
        current.source = source;
        current.device_name = device
            .description()
            .map(|d| d.name().to_owned())
            .unwrap_or_else(|_| "Selected audio device".into());
    }
    let config = (if source == InputSource::System {
        device.default_output_config()
    } else {
        device.default_input_config()
    })
    .user_error("Cannot open the audio device. Check the device and Windows permissions.")?;
    let stream_config: cpal::StreamConfig = config.into();
    let rate = stream_config.sample_rate;
    let channels = stream_config.channels as usize;
    if rate == 0 || channels == 0 {
        return Err("The audio device returned an invalid format.".into());
    }
    let file = std::fs::File::create(&path)
        .user_error("Cannot create the recording file. Check disk space and permissions.")?;
    let checkpoint = file
        .try_clone()
        .user_error("Cannot initialize the recording file.")?;
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::new(BufWriter::new(file), spec)
        .user_error("Cannot initialize WAV recording.")?;
    writer.flush().user_error("Cannot save the WAV header.")?;
    let (samples_tx, samples_rx) = sample_queue();
    let failed = Arc::new(AtomicBool::new(false));
    let stream = match config.sample_format() {
        SampleFormat::F32 => build_stream::<f32>(
            &device,
            stream_config,
            samples_tx,
            paused.clone(),
            health.clone(),
            failed.clone(),
        ),
        SampleFormat::I16 => build_stream::<i16>(
            &device,
            stream_config,
            samples_tx,
            paused.clone(),
            health.clone(),
            failed.clone(),
        ),
        SampleFormat::U16 => build_stream::<u16>(
            &device,
            stream_config,
            samples_tx,
            paused.clone(),
            health.clone(),
            failed.clone(),
        ),
        SampleFormat::I32 => build_stream::<i32>(
            &device,
            stream_config,
            samples_tx,
            paused.clone(),
            health.clone(),
            failed.clone(),
        ),
        SampleFormat::F64 => build_stream::<f64>(
            &device,
            stream_config,
            samples_tx,
            paused.clone(),
            health.clone(),
            failed.clone(),
        ),
        _ => return Err("This audio sample format is unsupported. Choose another device.".into()),
    }?;
    health.trace.event("start_requested", false, None, None);
    stream
        .play()
        .user_error("Cannot start audio capture. Close apps holding the device.")?;
    ready
        .send(Ok(()))
        .user_error("Recording startup cancelled.")?;
    let mut count = 0_u64;
    let mut peak = 0_f32;
    let mut event_at = Instant::now();
    let mut checkpoint_at = Instant::now();
    let mut trace_at = Instant::now();
    let mut voice_at = Instant::now();
    let mut error = None;
    loop {
        match controls.try_recv() {
            Ok(Control::Stop) | Err(mpsc::TryRecvError::Disconnected) => break,
            Ok(Control::Pause(value)) => {
                // Some WASAPI devices cannot pause; callback gating still prevents
                // paused audio from being stored or contributing to elapsed time.
                if value {
                    let _ = stream.pause();
                    health.trace.event("pause_command_queued", true, None, None);
                } else {
                    if stream.play().is_err() {
                        error = Some(
                            "Cannot resume the audio device. Earlier audio is preserved.".into(),
                        );
                        break;
                    }
                    voice_at = Instant::now();
                    health
                        .trace
                        .event("resume_command_queued", false, None, None);
                }
            }
            Err(mpsc::TryRecvError::Empty) => {}
        }
        if failed.load(Ordering::Relaxed) {
            error = Some(
                "Audio device disconnected or unavailable. Earlier audio is preserved.".into(),
            );
            break;
        }
        if let Ok(samples) = samples_rx.recv_timeout(Duration::from_millis(100)) {
            let buffered = samples.len();
            health
                .trace
                .measure("slow_sample_write", paused.load(Ordering::Relaxed), || {
                    for sample in samples {
                        peak = peak.max((sample as f32 / 32768.0).abs());
                        if writer.write_sample(sample).is_err() {
                            error = Some("Cannot write audio. Check available disk space.".into());
                            break;
                        }
                        count += 1;
                    }
                });
            health.trace.written.store(count, Ordering::Relaxed);
            health.consumed(buffered);
            if error.is_some() {
                break;
            }
        }
        if peak > 0.005 {
            voice_at = Instant::now();
        }
        if checkpoint_at.elapsed() >= Duration::from_secs(1) {
            let is_paused = paused.load(Ordering::Relaxed);
            if health
                .trace
                .measure("slow_wav_flush", is_paused, || writer.flush())
                .is_err()
                || health
                    .trace
                    .measure("slow_wav_sync", is_paused, || checkpoint.sync_all())
                    .is_err()
            {
                error = Some("Cannot save audio. Check available disk space.".into());
                break;
            }
            if health
                .trace
                .measure("slow_recovery_write", is_paused, || {
                    write_atomic(
                        &recovery,
                        format!("{{\"sampleCount\":{count},\"sampleRate\":{rate}}}").as_bytes(),
                    )
                })
                .is_err()
            {
                error =
                    Some("Cannot save the recovery checkpoint. Check available disk space.".into());
                break;
            }
            checkpoint_at = Instant::now();
        }
        if event_at.elapsed() >= Duration::from_millis(200) {
            let quality = health.snapshot();
            let warning = quality.warning().or_else(|| {
                (!paused.load(Ordering::Relaxed) && voice_at.elapsed() > Duration::from_secs(8))
                    .then(|| "No sound detected. Check the audio source and volume.".into())
            });
            if let Ok(mut shared) = status.lock() {
                shared.paused = paused.load(Ordering::Relaxed);
                shared.dropped_chunks = quality.total_events();
                shared.sample_rate = rate;
                shared.quality = quality;
                shared.duration_seconds = count as f64 / rate as f64;
                shared.level = if shared.paused { 0.0 } else { peak };
                shared.warning = warning;
                health.trace.measure("slow_status_emit", shared.paused, || {
                    let _ = app.emit("recording-status", shared.clone());
                });
            }
            peak = 0.0;
            event_at = Instant::now();
        }
        if trace_at.elapsed() >= Duration::from_secs(30) {
            // Bounded diagnostics are best-effort and outside the capture callback.
            health
                .trace
                .measure("slow_trace_save", paused.load(Ordering::Relaxed), || {
                    health.trace.save(&path, rate, channels, false)
                });
            trace_at = Instant::now();
        }
    }
    drop(stream);
    health
        .trace
        .event("stream_closed", paused.load(Ordering::Relaxed), None, None);
    // Drain audio captured before Stop so the last syllable is not discarded.
    for samples in samples_rx.try_iter() {
        let buffered = samples.len();
        for sample in samples {
            if writer.write_sample(sample).is_err() {
                error.get_or_insert("Cannot save the end of the recording.".into());
                break;
            }
            count += 1;
        }
        health.consumed(buffered);
    }
    if writer.finalize().is_err() || checkpoint.sync_all().is_err() {
        error.get_or_insert(
            "Recording could not finish normally. Saved audio will be recovered on restart.".into(),
        );
    }
    health.trace.written.store(count, Ordering::Relaxed);
    health
        .trace
        .event("wav_finalized", paused.load(Ordering::Relaxed), None, None);
    health.trace.save(&path, rate, channels, true);
    if let Ok(mut shared) = status.lock() {
        shared.duration_seconds = count as f64 / rate as f64;
        shared.failed = error.is_some();
        shared.quality = health.snapshot();
        shared.dropped_chunks = shared.quality.total_events();
        shared.sample_rate = rate;
        shared.warning = error.clone().or_else(|| shared.quality.warning());
        shared.level = 0.0;
        // Best-effort diagnostics must never make a successfully saved WAV fail.
        // Written after stream shutdown, including the last queued buffer/events.
        if let (Some(dir), Ok(bytes)) = (path.parent(), serde_json::to_vec_pretty(&*shared)) {
            let _ = write_atomic(&dir.join("recording-quality.json"), &bytes);
        }
        let _ = app.emit("recording-status", shared.clone());
    }
    Ok(AudioSummary {
        duration_seconds: count as f64 / rate as f64,
        error,
    })
}
