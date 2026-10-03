use crate::{
    AppState,
    app::assistance as ai,
    diagnostics::Monitor,
    domain::*,
    error::{AppResult, UserFacing},
    models::manager as model_manager,
    providers::{OfficialProvider, TranscriptionProvider, TranslationProvider},
    security::credentials,
    speech::local::worker::LocalSpeech,
    speech::translation_progress::TranslationProgress,
};
use serde::Serialize;
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub partial_text: String,
    pub status: String,
}
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStatus {
    pub active: bool,
    pub lecture_id: String,
    pub state: String,
    pub message: Option<String>,
    pub segments: Vec<TranscriptSegment>,
    pub draft: Option<Draft>,
    pub backlog_seconds: f64,
    pub translation_queue: usize,
    pub translation: TranslationProgress,
    pub measurements: crate::diagnostics::Measurements,
}
#[derive(Default)]
pub struct Live {
    running: AtomicBool,
    finish: AtomicBool,
    cancel: AtomicBool,
    pub status: Mutex<LiveStatus>,
}
impl Live {
    pub fn active(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }
    pub fn finish(&self) {
        self.finish.store(true, Ordering::Relaxed);
    }
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
        self.finish();
    }
    pub fn snapshot(&self) -> AppResult<LiveStatus> {
        self.status
            .lock()
            .map(|s| {
                let mut status = s.clone();
                status.active = self.active();
                if status.active && self.finish.load(Ordering::Relaxed) {
                    status.state = "finalizing".into();
                }
                status
            })
            .user_error("Live caption status unavailable.")
    }
    pub fn start(state: Arc<AppState>, app: tauri::AppHandle, id: String) {
        state.live.running.store(true, Ordering::Relaxed);
        state.live.finish.store(false, Ordering::Relaxed);
        state.live.cancel.store(false, Ordering::Relaxed);
        if let Ok(mut status) = state.live.status.lock() {
            *status = LiveStatus {
                active: true,
                lecture_id: id.clone(),
                state: "loading".into(),
                ..Default::default()
            };
            let _ = app.emit("live-status", &*status);
        }
        std::thread::spawn(move || {
            let task = state.storage.create_task(&id, "live-captions");
            let result = run(&state, &app, &id);
            if let Ok(task) = task {
                let _ = state.storage.finish_task(
                    &task,
                    if result.is_err() {
                        "failed"
                    } else if state.live.cancel.load(Ordering::Relaxed) {
                        "interrupted"
                    } else {
                        "completed"
                    },
                );
            }
            if let Ok(mut status) = state.live.status.lock() {
                status.active = false;
                status.state = if result.is_err() {
                    "unavailable"
                } else {
                    "ended"
                }
                .into();
                status.draft = None;
                status.translation_queue = 0;
                status.translation.finish();
                status.message = result.err();
                state.live.running.store(false, Ordering::Relaxed);
                let _ = app.emit("live-status", &*status);
            }
            let _ = state.storage.snapshot(&state.paths, &id);
            state.live.running.store(false, Ordering::Relaxed);
        });
    }
}

// A publication joins recorder-independent state, bounded caption history and diagnostics.
#[allow(clippy::too_many_arguments)]
fn publish(
    state: &AppState,
    app: &tauri::AppHandle,
    id: &str,
    monitor: &Arc<Mutex<Monitor>>,
    queue: &AtomicUsize,
    backlog: f64,
    draft: Option<Draft>,
    message: Option<String>,
) -> AppResult<()> {
    let mut measurements = monitor
        .lock()
        .user_error("Diagnostics unavailable.")?
        .data
        .clone();
    measurements.speech_backlog_seconds = backlog;
    measurements.translation_queue = queue.load(Ordering::Relaxed);
    // Serialize database snapshots with translation publications so an older
    // English-only snapshot cannot replace a newly translated caption.
    let mut status = state
        .live
        .status
        .lock()
        .user_error("Live status unavailable.")?;
    let segments = state.storage.latest_segments(id)?;
    let value = LiveStatus {
        active: true,
        lecture_id: id.into(),
        state: if state.live.finish.load(Ordering::Relaxed) {
            "finalizing"
        } else if message.is_some() {
            "degraded"
        } else {
            "listening"
        }
        .into(),
        message,
        segments,
        draft,
        backlog_seconds: backlog,
        translation_queue: measurements.translation_queue,
        translation: status.translation.clone(),
        measurements,
    };
    *status = value.clone();
    let _ = app.emit("live-status", value);
    Ok(())
}
fn run(state: &Arc<AppState>, app: &tauri::AppHandle, id: &str) -> AppResult<()> {
    let lecture = state.storage.lecture(id)?;
    let course = state.storage.course(&lecture.course_id)?;
    let context = ai::course_context(state, &course)?;
    let settings = state.storage.settings()?;
    let translation_configured = settings.provider != "none"
        && credentials::status(&settings.provider).is_ok_and(|status| status.has_key);
    if let Ok(mut status) = state.live.status.lock() {
        status.translation.enabled = settings.live_translation;
        status.translation.configured = translation_configured;
    }
    let mut local = if settings.speech_provider == "local" {
        Some(LocalSpeech::open(
            &state.runtime,
            &model_manager::path(state),
            &state.performance,
        )?)
    } else {
        None
    };
    if let Some(engine) = local.as_mut() {
        let terms = state
            .storage
            .glossary(&course.id)?
            .into_iter()
            .map(|term| term.source)
            .collect::<Vec<_>>();
        engine.set_glossary(&terms)?;
    }
    let provider = if local.is_none() {
        Some(OfficialProvider::new(
            &settings.speech_provider,
            &settings.chat_model,
        )?)
    } else {
        None
    };
    let pid = local.as_ref().map(LocalSpeech::process_id);
    let monitor = Arc::new(Mutex::new(Monitor::new(pid)));
    let queue = Arc::new(AtomicUsize::new(0));
    let (translations, receiver) = mpsc::sync_channel::<Vec<TranscriptSegment>>(8);
    let translation_thread = if settings.live_translation && translation_configured {
        let state = state.clone();
        let app = app.clone();
        let id = id.to_owned();
        let context = context.clone();
        let monitor = monitor.clone();
        let queue = queue.clone();
        Some(std::thread::spawn(move || {
            let Ok(provider) = OfficialProvider::new(&settings.provider, &settings.chat_model)
            else {
                return;
            };
            while let Ok(batch) = receiver.recv() {
                if state.live.cancel.load(Ordering::Relaxed) {
                    queue.fetch_sub(1, Ordering::Relaxed);
                    break;
                }
                let at = Instant::now();
                let result = tauri::async_runtime::block_on(async {
                    tokio::time::timeout(
                        Duration::from_secs(20),
                        provider.translate(&context, &batch, &course.assistance_language),
                    )
                    .await
                    .map_err(|_| "Live translation timed out. English is preserved.".to_string())?
                });
                match result {
                    Ok(result) => {
                        if state.live.cancel.load(Ordering::Relaxed) {
                            queue.fetch_sub(1, Ordering::Relaxed);
                            break;
                        }
                        let saved = super::translation_progress::persist(
                            &state.storage,
                            &id,
                            &batch,
                            &result,
                            &course.assistance_language,
                        );
                        if let Ok(mut m) = monitor.lock() {
                            m.translation(at.elapsed().as_secs_f64() * 1000.0);
                        }
                        queue.fetch_sub(1, Ordering::Relaxed);
                        if let Ok(mut s) = state.live.status.lock() {
                            for (segment_id, saved) in saved {
                                s.translation.complete(&segment_id, saved);
                            }
                            if let Ok(segments) = state.storage.latest_segments(&id) {
                                s.segments = segments;
                            }
                            s.translation_queue = queue.load(Ordering::Relaxed);
                            let _ = app.emit("live-status", &*s);
                        }
                    }
                    Err(_) => {
                        queue.fetch_sub(1, Ordering::Relaxed);
                        if let Ok(mut s) = state.live.status.lock() {
                            for segment in &batch {
                                s.translation.complete(&segment.id, false);
                            }
                            s.translation_queue = queue.load(Ordering::Relaxed);
                            let _ = app.emit("live-status", &*s);
                        }
                    }
                }
            }
        }))
    } else {
        drop(receiver);
        None
    };
    let path = state.paths.recording(&lecture.course_id, id)?;
    let mut cursor = lecture.transcribed_until;
    let mut utterance_start = cursor;
    let seconds = 2.0;
    let mut last_sample = Instant::now();
    let mut failures = 0;
    let mut last_write = Instant::now();
    let work = (|| -> AppResult<()> {
        loop {
            if state.live.cancel.load(Ordering::Relaxed) {
                break;
            }
            let finishing = state.live.finish.load(Ordering::Relaxed);
            let mut reader = match hound::WavReader::open(&path) {
                Ok(r) => r,
                Err(_) => {
                    if finishing {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(250));
                    continue;
                }
            };
            let spec = reader.spec();
            if spec.sample_rate == 0 || spec.channels != 1 || spec.bits_per_sample != 16 {
                return Err("Unsupported live audio format.".into());
            }
            let duration = reader.duration() as f64 / spec.sample_rate as f64;
            let backlog = (duration - cursor).max(0.0);
            if last_sample.elapsed() >= Duration::from_secs(5) {
                if let Ok(mut m) = monitor.lock() {
                    m.sample(pid);
                    m.data.dropped_chunks = state
                        .recorder
                        .status()?
                        .map(|s| s.dropped_chunks)
                        .unwrap_or(m.data.dropped_chunks);
                }
                last_sample = Instant::now();
            }
            if last_write.elapsed() >= Duration::from_secs(30) {
                write_measurements(state, id, &monitor)?;
                last_write = Instant::now();
            }
            if backlog < seconds && !finishing {
                std::thread::sleep(Duration::from_millis(250));
                continue;
            }
            if backlog < 0.05 {
                if finishing {
                    if cursor > utterance_start
                        && let Some(engine) = local.as_mut()
                    {
                        let update = engine.finish()?;
                        let segments = if update.text.trim().is_empty() {
                            vec![]
                        } else {
                            vec![local_segment(id, utterance_start, cursor, update.text)]
                        };
                        state.storage.append_cloud_chunk(id, &segments, cursor)?;
                        if !segments.is_empty() && translation_thread.is_some() {
                            enqueue_translation(state, &translations, &queue, segments);
                        }
                    }
                    break;
                }
                continue;
            }
            let span = backlog.min(seconds);
            reader
                .seek((cursor * spec.sample_rate as f64).round() as u32)
                .user_error("Cannot read live audio checkpoint.")?;
            let samples = reader
                .samples::<i16>()
                .take((span * spec.sample_rate as f64).round() as usize)
                .collect::<hound::Result<Vec<_>>>()
                .user_error("Cannot read live audio. Recording continues.")?;
            if samples.is_empty() {
                if finishing {
                    break;
                }
                continue;
            }
            let end = cursor + samples.len() as f64 / spec.sample_rate as f64;
            let base = if local.is_some() {
                utterance_start
            } else {
                cursor
            };
            let draft = Draft {
                id: format!("{id}:{}", (base * 1000.0).round() as u64),
                start_seconds: base,
                end_seconds: end,
                partial_text: state
                    .live
                    .status
                    .lock()
                    .ok()
                    .and_then(|s| s.draft.as_ref().map(|d| d.partial_text.clone()))
                    .unwrap_or_default(),
                status: "partial".into(),
            };
            publish(
                state,
                app,
                id,
                &monitor,
                &queue,
                backlog,
                Some(draft),
                if backlog > 12.0 {
                    Some(
                        "Captions are delayed. Recording is complete; catch up after class.".into(),
                    )
                } else {
                    None
                },
            )?;
            let at = Instant::now();
            // Never infer on near-silence: this reduces fan load and silence hallucinations.
            let quiet = samples.iter().all(|s| s.unsigned_abs() < 120);
            let mut partial = None;
            let response = if quiet && local.is_none() {
                Ok(Vec::new())
            } else if let Some(engine) = local.as_mut() {
                engine
                    .feed(&samples, spec.sample_rate)
                    .and_then(|mut update| {
                        if !update.is_final && finishing && backlog <= seconds + 0.05 {
                            update = engine.finish()?;
                        }
                        if !update.is_final {
                            partial = Some(update.text);
                            return Ok(vec![]);
                        }
                        Ok(vec![crate::providers::SpeechSegment {
                            start: 0.0,
                            end: end - base,
                            text: update.text,
                        }])
                    })
            } else {
                let wav = crate::audio::wav::encode_chunk(&samples, spec)?;
                let provider = provider.as_ref().ok_or("Speech provider unavailable.")?;
                tauri::async_runtime::block_on(async {
                    tokio::time::timeout(
                        Duration::from_secs(15),
                        provider.transcribe(wav, &context),
                    )
                    .await
                    .map_err(|_| "Live transcription timed out. Recording continues.".to_string())?
                })
            };
            let response = match response {
                Ok(v) => {
                    failures = 0;
                    v
                }
                Err(error) => {
                    failures += 1;
                    publish(
                        state,
                        app,
                        id,
                        &monitor,
                        &queue,
                        backlog,
                        None,
                        Some(error.clone()),
                    )?;
                    if local.is_some() || finishing || failures >= 3 {
                        return Err(error);
                    }
                    std::thread::sleep(Duration::from_secs(2));
                    continue;
                }
            };
            if let Ok(mut m) = monitor.lock() {
                m.stt(at.elapsed().as_secs_f64() * 1000.0);
            }
            if let Some(text) = partial {
                cursor = end;
                publish(
                    state,
                    app,
                    id,
                    &monitor,
                    &queue,
                    (duration - cursor).max(0.0),
                    Some(Draft {
                        id: format!("{id}:{}", (base * 1000.0).round() as u64),
                        start_seconds: base,
                        end_seconds: end,
                        partial_text: text,
                        status: "partial".into(),
                    }),
                    None,
                )?;
                continue;
            }
            let mut segments = Vec::new();
            for (index, s) in response.into_iter().enumerate() {
                if s.text.trim().is_empty() {
                    continue;
                }
                if !s.start.is_finite()
                    || !s.end.is_finite()
                    || s.end < s.start
                    || s.text.len() > 10000
                {
                    return Err("Invalid live speech response. Audio is preserved.".into());
                }
                let segment_span = end - base;
                let start = s.start.clamp(0.0, segment_span);
                let finish = s.end.clamp(start, segment_span);
                segments.push(TranscriptSegment {
                    id: format!("{id}:{}:{index}", (base * 1000.0).round() as u64),
                    lecture_id: id.into(),
                    start_seconds: base + start,
                    end_seconds: base + finish,
                    source_text: s.text.trim().into(),
                    translated_text: String::new(),
                    origin: "cloud".into(),
                    provider: settings.speech_provider.clone(),
                    status: "final".into(),
                    transcript_version: "live".into(),
                    revision: 0,
                });
            }
            state.storage.append_cloud_chunk(id, &segments, end)?;
            cursor = end;
            utterance_start = end;
            if !segments.is_empty() && translation_thread.is_some() {
                enqueue_translation(state, &translations, &queue, segments);
            }
            publish(
                state,
                app,
                id,
                &monitor,
                &queue,
                (duration - cursor).max(0.0),
                None,
                None,
            )?;
            // Disk-backed backlog is bounded in memory. Stop leaves any remaining audio for post-stop STT.
            if finishing && backlog > 12.0 {
                break;
            }
        }
        Ok(())
    })();
    drop(translations);
    if let Ok(mut status) = state.live.status.lock() {
        status.state = "finalizing".into();
        status.draft = None;
        status.translation_queue = queue.load(Ordering::Relaxed);
        if let Ok(segments) = state.storage.latest_segments(id) {
            status.segments = segments;
        }
        let _ = app.emit("live-status", &*status);
    }
    if let Some(t) = translation_thread {
        let _ = t.join();
    }
    queue.store(0, Ordering::Relaxed);
    if let Ok(mut m) = monitor.lock() {
        m.sample(pid);
    }
    write_measurements(state, id, &monitor)?;
    work
}
fn enqueue_translation(
    state: &AppState,
    sender: &mpsc::SyncSender<Vec<TranscriptSegment>>,
    queue: &AtomicUsize,
    segments: Vec<TranscriptSegment>,
) {
    if let Ok(mut status) = state.live.status.lock() {
        for segment in &segments {
            status.translation.pending(&segment.id);
        }
    }
    queue.fetch_add(1, Ordering::Relaxed);
    if let Err(error) = sender.try_send(segments) {
        queue.fetch_sub(1, Ordering::Relaxed);
        let (mpsc::TrySendError::Full(segments) | mpsc::TrySendError::Disconnected(segments)) =
            error;
        if let Ok(mut status) = state.live.status.lock() {
            for segment in &segments {
                status.translation.complete(&segment.id, false);
            }
        }
    }
}
fn write_measurements(state: &AppState, id: &str, monitor: &Mutex<Monitor>) -> AppResult<()> {
    let data = monitor
        .lock()
        .user_error("Diagnostics unavailable.")?
        .data
        .clone();
    let bytes = serde_json::to_vec_pretty(&data).user_error("Cannot encode diagnostics.")?;
    crate::storage::write_atomic(
        &state
            .paths
            .data
            .join("logs")
            .join(format!("{id}-performance.json")),
        &bytes,
    )
}
fn local_segment(id: &str, start: f64, end: f64, text: String) -> TranscriptSegment {
    TranscriptSegment {
        id: format!("{id}:{}:0", (start * 1000.0).round() as u64),
        lecture_id: id.into(),
        start_seconds: start,
        end_seconds: end,
        source_text: text,
        translated_text: String::new(),
        origin: "cloud".into(),
        provider: "local".into(),
        status: "final".into(),
        transcript_version: "live".into(),
        revision: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stopped_recording_reports_remaining_work_without_losing_error() {
        let live = Live::default();
        live.running.store(true, Ordering::Relaxed);
        *live.status.lock().unwrap() = LiveStatus {
            lecture_id: "fixture".into(),
            state: "degraded".into(),
            translation_queue: 2,
            message: Some("Translation unavailable. English is preserved.".into()),
            ..Default::default()
        };
        live.finish();
        let status = live.snapshot().unwrap();
        assert!(status.active);
        assert_eq!(status.state, "finalizing");
        assert_eq!(status.translation_queue, 2);
        assert!(status.message.unwrap().contains("English is preserved"));
        live.running.store(false, Ordering::Relaxed);
        assert!(!live.snapshot().unwrap().active);
    }
}
