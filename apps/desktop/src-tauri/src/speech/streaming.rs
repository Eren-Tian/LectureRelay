use super::live_translation::{
    Request, StablePrefix, TranslationPreview, TranslationQueue, prefix_matches,
};
use crate::{
    AppState,
    app::assistance as ai,
    diagnostics::Monitor,
    domain::*,
    error::{AppResult, UserFacing},
    models::manager as model_manager,
    providers::{
        LiveTranslationControl, OfficialProvider, Role, TranscriptionProvider, configured_text,
    },
    security::credentials,
    speech::local::worker::LocalSpeech,
    speech::translation_progress::TranslationProgress,
};
use serde::Serialize;
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
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
    pub generation: u64,
    pub sequence: u64,
    pub active: bool,
    pub lecture_id: String,
    pub target_language: String,
    pub state: String,
    pub message: Option<String>,
    pub segments: Vec<TranscriptSegment>,
    pub draft: Option<Draft>,
    pub backlog_seconds: f64,
    pub translation_queue: usize,
    pub translation_paused: bool,
    pub translation: TranslationProgress,
    pub translation_previews: Vec<TranslationPreview>,
    pub measurements: crate::diagnostics::Measurements,
}
#[derive(Default)]
pub struct Live {
    generation: AtomicU64,
    running: AtomicBool,
    finish: AtomicBool,
    cancel: AtomicBool,
    translation_paused: AtomicBool,
    processed_ms: AtomicU64,
    pub status: Mutex<LiveStatus>,
}
impl Live {
    pub fn pause_translation(&self, paused: bool) {
        self.translation_paused.store(paused, Ordering::Relaxed);
        if let Ok(mut status) = self.status.lock() {
            status.translation_paused = paused;
            status.sequence += 1;
        }
    }
    pub fn translation_paused(&self) -> bool {
        self.translation_paused.load(Ordering::Relaxed)
    }
    pub fn backlog(&self, recorded_seconds: f64) -> f64 {
        (recorded_seconds - self.processed_ms.load(Ordering::Relaxed) as f64 / 1000.0).max(0.0)
    }
    fn progressed(&self, seconds: f64) {
        self.processed_ms.store(
            (seconds.max(0.0) * 1000.0).round() as u64,
            Ordering::Relaxed,
        );
    }
    pub fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }
    pub fn active(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }
    pub fn finish(&self) {
        self.finish.store(true, Ordering::Relaxed);
        if let Ok(mut status) = self.status.lock() {
            if status.active {
                status.state = "finalizing".into();
            }
            status.sequence += 1;
        }
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
                status.translation_paused = self.translation_paused();
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
        state
            .live
            .translation_paused
            .store(false, Ordering::Relaxed);
        state.live.progressed(0.0);
        if let Ok(mut status) = state.live.status.lock() {
            *status = LiveStatus {
                generation: state.live.generation.fetch_add(1, Ordering::Relaxed) + 1,
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
            // Keep the live slot occupied through the final sidecar write. Once
            // running becomes false a new session may start; never reset it again.
            let _ = state.storage.snapshot(&state.paths, &id);
            if let Ok(mut status) = state.live.status.lock() {
                status.active = false;
                status.state = if result.is_err() {
                    "unavailable"
                } else {
                    "ended"
                }
                .into();
                status.draft = None;
                status.translation_previews.clear();
                status.translation_queue = 0;
                status.translation.finish();
                status.message = result.err();
                status.sequence += 1;
                state.live.running.store(false, Ordering::Relaxed);
                let _ = app.emit("live-status", &*status);
            } else {
                state.live.running.store(false, Ordering::Relaxed);
            }
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
    let backlog = state
        .recorder
        .status()?
        .filter(|r| r.lecture_id == id)
        .map(|r| state.live.backlog(r.duration_seconds))
        .unwrap_or(backlog);
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
    let mut previews = status.translation_previews.clone();
    previews.retain(|preview| preview_valid(preview, &segments, draft.as_ref()));
    let value = LiveStatus {
        generation: status.generation,
        sequence: status.sequence + 1,
        active: true,
        lecture_id: id.into(),
        target_language: status.target_language.clone(),
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
        translation_paused: state.live.translation_paused(),
        translation: status.translation.clone(),
        translation_previews: previews,
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
    let translation_configured = match settings.translation_mode.as_str() {
        "local" => model_manager::status_for(state, &settings.translation_model)?.installed,
        "cloud" => {
            settings.provider != "none"
                && credentials::status(&settings.provider).is_ok_and(|status| status.has_key)
        }
        _ => false,
    };
    if let Ok(mut status) = state.live.status.lock() {
        status.target_language = course.assistance_language.clone();
        status.translation.enabled =
            settings.live_translation && settings.translation_mode != "none";
        status.translation.configured = translation_configured;
    }
    crate::diagnostics::caption_stage(&state.paths, id, "speech_prepare_start", &[], 0.0);
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
    crate::diagnostics::caption_stage(&state.paths, id, "speech_ready", &[], 0.0);
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
    let preview_enabled = settings.speech_provider == "local"
        && settings.translation_mode == "local"
        && settings.live_translation
        && translation_configured;
    // One replaceable preview and two final batches; recording never waits on either.
    let translations = Arc::new(TranslationQueue::default());
    let translation_thread = if settings.live_translation && translation_configured {
        let state = state.clone();
        let app = app.clone();
        let id = id.to_owned();
        let context = context.clone();
        let monitor = monitor.clone();
        let queue = queue.clone();
        let translations = translations.clone();
        let local_translation = settings.translation_mode == "local";
        Some(std::thread::spawn(move || {
            let Ok(provider) = configured_text(&state, Role::Translation, true) else {
                return;
            };
            if local_translation {
                crate::diagnostics::caption_stage(
                    &state.paths,
                    &id,
                    "translation_prepare_start",
                    &[],
                    0.0,
                );
                let warmup = tauri::async_runtime::block_on(async {
                    tokio::time::timeout(Duration::from_secs(30), provider.prepare_live())
                        .await
                        .map_err(|_| {
                            "Local model loading timed out. Recording is preserved.".to_string()
                        })?
                });
                crate::diagnostics::caption_stage(
                    &state.paths,
                    &id,
                    if warmup.is_ok() {
                        "translation_ready"
                    } else {
                        "translation_prepare_failed"
                    },
                    &[],
                    0.0,
                );
                if let Err(error) = warmup
                    && let Ok(mut status) = state.live.status.lock()
                {
                    status.message = Some(error);
                }
            }
            while let Ok(Some(request)) = translations.next() {
                let preview = matches!(request, Request::Preview(_));
                let batch = match request {
                    Request::Preview(segment) => vec![segment],
                    Request::Final(batch) => batch,
                };
                if state.live.cancel.load(Ordering::Relaxed) {
                    if !preview {
                        queue.fetch_sub(1, Ordering::Relaxed);
                    }
                    break;
                }
                let recording = state.recorder.status().ok().flatten();
                if state.live.translation_paused()
                    || recording.as_ref().is_some_and(|r| {
                        translation_is_stale(
                            r.duration_seconds,
                            batch.last().map(|s| s.end_seconds).unwrap_or(0.0),
                        ) || state.live.backlog(r.duration_seconds) > 6.0
                    })
                {
                    if !preview {
                        queue.fetch_sub(1, Ordering::Relaxed);
                    }
                    if let Ok(mut s) = state.live.status.lock() {
                        if !preview {
                            for segment in &batch {
                                s.translation.complete(&segment.id, false);
                            }
                        }
                        s.translation_queue = queue.load(Ordering::Relaxed);
                        s.sequence += 1;
                        let _ = app.emit("live-status", &*s);
                    }
                    continue;
                }
                let at = Instant::now();
                crate::diagnostics::caption_stage(
                    &state.paths,
                    &id,
                    if preview {
                        "preview_start"
                    } else {
                        "translation_start"
                    },
                    &batch,
                    0.0,
                );
                if !preview
                    && let Ok(mut status) = state.live.status.lock()
                    && let Ok(segments) = state.storage.latest_segments(&id)
                {
                    status.segments = segments;
                }
                let superseded = || {
                    preview
                        && (translations.preview_should_yield()
                            || state.live.finish.load(Ordering::Relaxed)
                            || !state
                                .live
                                .status
                                .lock()
                                .is_ok_and(|status| request_valid(&status, &batch[0], true)))
                };
                let last_update = Mutex::new(None::<Instant>);
                let progress = |segment_id: &str, text: &str| {
                    let Some(segment) = batch.iter().find(|s| s.id == segment_id) else {
                        return;
                    };
                    let Ok(mut last) = last_update.lock() else {
                        return;
                    };
                    let first = last.is_none();
                    if !first && last.is_some_and(|at| at.elapsed() < Duration::from_millis(150)) {
                        return;
                    }
                    if superseded() {
                        return;
                    }
                    if show_translation_preview(
                        &state,
                        &app,
                        segment,
                        &course.assistance_language,
                        text,
                        preview,
                    ) {
                        *last = Some(Instant::now());
                        if first {
                            crate::diagnostics::caption_stage(
                                &state.paths,
                                &id,
                                if preview {
                                    "preview_first_delta"
                                } else {
                                    "translation_first_delta"
                                },
                                std::slice::from_ref(segment),
                                0.0,
                            );
                        }
                    }
                };
                let result = tauri::async_runtime::block_on(async {
                    tokio::time::timeout(
                        Duration::from_secs(if settings.translation_mode == "local" {
                            30
                        } else {
                            20
                        }),
                        async {
                            if local_translation {
                                provider
                                    .translate_live(
                                        &context,
                                        &batch,
                                        &course.assistance_language,
                                        LiveTranslationControl {
                                            progress: &progress,
                                            superseded: &superseded,
                                            preview,
                                        },
                                    )
                                    .await
                            } else {
                                provider
                                    .translate(&context, &batch, &course.assistance_language)
                                    .await
                            }
                        },
                    )
                    .await
                    .map_err(|_| "Live translation timed out. English is preserved.".to_string())?
                });
                crate::diagnostics::caption_stage(
                    &state.paths,
                    &id,
                    if preview {
                        "preview_done"
                    } else {
                        "translation_done"
                    },
                    &batch,
                    0.0,
                );
                if preview {
                    if let Ok(result) = result
                        && !superseded()
                        && let Some(value) = result.iter().find(|r| r.id == batch[0].id)
                    {
                        show_translation_preview(
                            &state,
                            &app,
                            &batch[0],
                            &course.assistance_language,
                            &value.text,
                            true,
                        );
                    }
                    continue;
                }
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
                            s.translation_previews
                                .retain(|p| !batch.iter().any(|s| s.id == p.id));
                            s.translation_queue = queue.load(Ordering::Relaxed);
                            s.sequence += 1;
                            let _ = app.emit("live-status", &*s);
                            crate::diagnostics::caption_stage(
                                &state.paths,
                                &id,
                                "translation_published",
                                &batch,
                                0.0,
                            );
                        }
                    }
                    Err(error) => {
                        queue.fetch_sub(1, Ordering::Relaxed);
                        if let Ok(mut s) = state.live.status.lock() {
                            s.message = Some(error);
                            for segment in &batch {
                                s.translation.complete(&segment.id, false);
                            }
                            s.translation_previews
                                .retain(|p| !batch.iter().any(|s| s.id == p.id));
                            s.translation_queue = queue.load(Ordering::Relaxed);
                            s.sequence += 1;
                            let _ = app.emit("live-status", &*s);
                        }
                    }
                }
            }
        }))
    } else {
        None
    };
    let path = state.paths.recording(&lecture.course_id, id)?;
    let mut cursor = lecture.transcribed_until;
    state.live.progressed(cursor);
    let mut utterance_start = cursor;
    // Two native 160 ms blocks. Cloud transcription retains its existing batch policy.
    let seconds = if local.is_some() { 0.32 } else { 2.0 };
    let mut stable_prefix = StablePrefix::default();
    let preview_clock = Instant::now();
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
                    std::thread::sleep(Duration::from_millis(100));
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
                    if let Some(recording) = state.recorder.status()? {
                        m.data.dropped_chunks = recording.dropped_chunks;
                        m.data.dropped_buffers = recording.quality.dropped_buffers;
                        m.data.dropped_samples = recording.quality.dropped_samples;
                        m.data.device_discontinuities = recording.quality.device_discontinuities;
                    }
                }
                last_sample = Instant::now();
            }
            if last_write.elapsed() >= Duration::from_secs(30) {
                write_measurements(state, id, &monitor)?;
                last_write = Instant::now();
            }
            if backlog < seconds && !finishing {
                std::thread::sleep(Duration::from_millis(100));
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
                        "English captions are behind. Audio is still being saved. Try Full performance; remaining text can be transcribed after class.".into(),
                    )
                } else {
                    None
                },
            )?;
            let at = Instant::now();
            crate::diagnostics::caption_stage(&state.paths, id, "speech_start", &[], end);
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
                state.live.progressed(cursor);
                crate::diagnostics::caption_stage(
                    &state.paths,
                    id,
                    "speech_partial",
                    &[local_segment(id, base, end, text.clone())],
                    end,
                );
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
                        partial_text: text.clone(),
                        status: "partial".into(),
                    }),
                    None,
                )?;
                if preview_enabled
                    && !finishing
                    && !state.live.translation_paused()
                    && state.live.backlog(duration) <= 3.0
                    && let Some((source, revision)) =
                        stable_prefix.observe(&text, preview_clock.elapsed().as_millis() as u64)
                {
                    let mut segment = local_segment(id, base, end, source);
                    segment.revision = revision as i64;
                    crate::diagnostics::caption_stage(
                        &state.paths,
                        id,
                        "preview_eligible",
                        std::slice::from_ref(&segment),
                        end,
                    );
                    translations.preview(segment);
                }
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
                    origin: if settings.speech_provider == "local" {
                        "local"
                    } else {
                        "cloud"
                    }
                    .into(),
                    provider: settings.speech_provider.clone(),
                    status: "final".into(),
                    transcript_version: "live".into(),
                    revision: 0,
                });
            }
            state.storage.append_cloud_chunk(id, &segments, end)?;
            crate::diagnostics::caption_stage(&state.paths, id, "speech_final", &segments, end);
            cursor = end;
            state.live.progressed(cursor);
            utterance_start = end;
            stable_prefix = StablePrefix::default();
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
    translations.close();
    drop(local);
    if let Ok(mut status) = state.live.status.lock() {
        status.state = "finalizing".into();
        status.draft = None;
        status.translation_queue = queue.load(Ordering::Relaxed);
        if let Ok(segments) = state.storage.latest_segments(id) {
            status.segments = segments;
        }
        let segments = status.segments.clone();
        status
            .translation_previews
            .retain(|p| preview_valid(p, &segments, None));
        status.sequence += 1;
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
    sender: &TranslationQueue,
    queue: &AtomicUsize,
    segments: Vec<TranscriptSegment>,
) {
    if state.live.translation_paused() {
        if let Ok(mut status) = state.live.status.lock() {
            for segment in &segments {
                status.translation.complete(&segment.id, false);
            }
        }
        return;
    }
    if let Some(segment) = segments.first() {
        crate::diagnostics::caption_stage(
            &state.paths,
            &segment.lecture_id,
            "translation_queued",
            &segments,
            0.0,
        );
    }
    if let Ok(mut status) = state.live.status.lock() {
        for segment in &segments {
            status.translation.pending(&segment.id);
        }
    }
    queue.fetch_add(1, Ordering::Relaxed);
    if let Some(segments) = sender.final_batch(segments) {
        queue.fetch_sub(1, Ordering::Relaxed);
        if let Ok(mut status) = state.live.status.lock() {
            for segment in &segments {
                status.translation.complete(&segment.id, false);
            }
        }
    }
}
fn preview_valid(
    preview: &TranslationPreview,
    segments: &[TranscriptSegment],
    draft: Option<&Draft>,
) -> bool {
    segments.iter().any(|s| {
        s.translated_text.is_empty() && preview.matches(&s.id, &s.source_text, &preview.language)
    }) || draft.is_some_and(|d| {
        preview.matches(&format!("{}:0", d.id), &d.partial_text, &preview.language)
    })
}
fn request_valid(status: &LiveStatus, segment: &TranscriptSegment, preview: bool) -> bool {
    status.lecture_id == segment.lecture_id
        && (status.segments.iter().any(|s| {
            s.id == segment.id
                && s.translated_text.is_empty()
                && if preview {
                    prefix_matches(&s.source_text, &segment.source_text)
                } else {
                    s.source_text == segment.source_text && s.revision == segment.revision
                }
        }) || (preview
            && status.draft.as_ref().is_some_and(|d| {
                format!("{}:0", d.id) == segment.id
                    && prefix_matches(&d.partial_text, &segment.source_text)
            })))
}
fn show_translation_preview(
    state: &AppState,
    app: &tauri::AppHandle,
    segment: &TranscriptSegment,
    language: &str,
    text: &str,
    preview: bool,
) -> bool {
    if text.trim().is_empty() || text.len() > 20000 {
        return false;
    }
    let Ok(mut status) = state.live.status.lock() else {
        return false;
    };
    if !request_valid(&status, segment, preview) {
        return false;
    }
    if let Some(existing) = status
        .translation_previews
        .iter()
        .find(|p| p.id == segment.id)
        && preview
        && (existing.kind == "final" || existing.source_revision > segment.revision as u64)
    {
        return false;
    }
    status.translation_previews.retain(|p| p.id != segment.id);
    status.translation_previews.push(TranslationPreview {
        id: segment.id.clone(),
        source_text: segment.source_text.clone(),
        source_revision: segment.revision as u64,
        language: language.into(),
        translated_text: text.into(),
        kind: if preview { "draft" } else { "final" }.into(),
    });
    if status.translation_previews.len() > 4 {
        status.translation_previews.remove(0);
    }
    status.sequence += 1;
    let _ = app.emit("live-status", &*status);
    true
}
fn translation_is_stale(recorded_seconds: f64, segment_end: f64) -> bool {
    recorded_seconds - segment_end > 16.0
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
        origin: "local".into(),
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
    fn live_delay_tracks_processed_audio_and_translation_age_has_a_bound() {
        let live = Live::default();
        live.progressed(180.0);
        assert_eq!(live.backlog(300.0), 120.0);
        assert_eq!(live.backlog(100.0), 0.0);
        assert!(translation_is_stale(300.0, 180.0));
        assert!(!translation_is_stale(300.0, 290.0));
        live.pause_translation(true);
        assert!(live.snapshot().unwrap().translation_paused);
        live.pause_translation(false);
        assert!(!live.snapshot().unwrap().translation_paused);
    }

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
