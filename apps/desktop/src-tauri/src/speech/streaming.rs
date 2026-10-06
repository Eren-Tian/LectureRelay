use super::live_translation::{TranslationPreview, TranslationQueue};
use super::recognition::{Progress, Recognition, Recognizer};
use super::translation_worker::TranslationWorker;
use crate::{
    AppState,
    app::assistance as ai,
    diagnostics::Monitor,
    domain::*,
    error::{AppResult, UserFacing},
    models::manager as model_manager,
    providers::OfficialProvider,
    security::credentials,
    speech::local::worker::LocalSpeech,
    speech::translation_progress::TranslationProgress,
};
use serde::Serialize;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
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
    pub(super) fn progressed(&self, seconds: f64) {
        self.processed_ms.store(
            (seconds.max(0.0) * 1000.0).round() as u64,
            Ordering::Relaxed,
        );
    }
    pub fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }
    /// Stop was requested; drain remaining audio and translation.
    pub fn finishing(&self) -> bool {
        self.finish.load(Ordering::Relaxed)
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
        let emit: Emit = Arc::new(move |status| {
            let _ = app.emit("live-status", status);
        });
        Self::start_with(state, emit, id);
    }
    /// Start a live session that reports every status change through `emit`.
    pub(crate) fn start_with(state: Arc<AppState>, emit: Emit, id: String) {
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
            emit(&status);
        }
        std::thread::spawn(move || {
            let task = state.storage.create_task(&id, "live-captions");
            let result = run(&state, &emit, &id);
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
                emit(&status);
            } else {
                state.live.running.store(false, Ordering::Relaxed);
            }
        });
    }
}

/// Delivers a live status to the interface (the `live-status` event).
pub(crate) type Emit = Arc<dyn Fn(&LiveStatus) + Send + Sync>;

/// Handles shared by the recognition loop, the translation worker and
/// publications for one live session.
#[derive(Clone)]
pub(super) struct LiveSession {
    pub state: Arc<AppState>,
    pub emit: Emit,
    pub id: String,
    pub monitor: Arc<Mutex<Monitor>>,
    /// Final translation batches queued or in flight.
    pub queue: Arc<AtomicUsize>,
}

impl LiveSession {
    /// A publication joins recorder-independent state, bounded caption history and diagnostics.
    pub fn publish(
        &self,
        backlog: f64,
        draft: Option<Draft>,
        message: Option<String>,
    ) -> AppResult<()> {
        let state = &self.state;
        let backlog = state
            .recorder
            .status()?
            .filter(|r| r.lecture_id == self.id)
            .map(|r| state.live.backlog(r.duration_seconds))
            .unwrap_or(backlog);
        let mut measurements = self
            .monitor
            .lock()
            .user_error("Diagnostics unavailable.")?
            .data
            .clone();
        measurements.speech_backlog_seconds = backlog;
        measurements.translation_queue = self.queue.load(Ordering::Relaxed);
        // Serialize database snapshots with translation publications so an older
        // English-only snapshot cannot replace a newly translated caption.
        let mut status = state
            .live
            .status
            .lock()
            .user_error("Live status unavailable.")?;
        let segments = state.storage.latest_segments(&self.id)?;
        let mut previews = status.translation_previews.clone();
        previews.retain(|preview| preview_valid(preview, &segments, draft.as_ref()));
        let value = LiveStatus {
            generation: status.generation,
            sequence: status.sequence + 1,
            active: true,
            lecture_id: self.id.clone(),
            target_language: status.target_language.clone(),
            state: if state.live.finishing() {
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
        (self.emit)(&value);
        Ok(())
    }

    pub fn write_measurements(&self) -> AppResult<()> {
        let data = self
            .monitor
            .lock()
            .user_error("Diagnostics unavailable.")?
            .data
            .clone();
        let bytes = serde_json::to_vec_pretty(&data).user_error("Cannot encode diagnostics.")?;
        crate::storage::write_atomic(
            &self
                .state
                .paths
                .data
                .join("logs")
                .join(format!("{}-performance.json", self.id)),
            &bytes,
        )
    }
}

fn run(state: &Arc<AppState>, emit: &Emit, id: &str) -> AppResult<()> {
    let lecture = state.storage.lecture(id)?;
    let course = state.storage.course(&lecture.course_id)?;
    let context = ai::course_context(state, &course)?;
    let settings = state.storage.settings()?;
    let translation_configured = match settings.translation_mode {
        ProcessingMode::Local => {
            model_manager::status_for(state, &settings.translation_model)?.installed
        }
        ProcessingMode::Cloud => settings.provider.cloud().is_some_and(|provider| {
            credentials::status(provider).is_ok_and(|status| status.has_key)
        }),
        ProcessingMode::None => false,
    };
    if let Ok(mut status) = state.live.status.lock() {
        status.target_language = course.assistance_language.clone();
        status.translation.enabled =
            settings.live_translation && settings.translation_mode != ProcessingMode::None;
        status.translation.configured = translation_configured;
    }
    crate::diagnostics::caption_stage(&state.paths, id, "speech_prepare_start", &[], 0.0);
    let recognizer = open_recognizer(state, &settings, &course.id)?;
    crate::diagnostics::caption_stage(&state.paths, id, "speech_ready", &[], 0.0);
    let pid = recognizer.process_id();
    let session = LiveSession {
        state: state.clone(),
        emit: emit.clone(),
        id: id.to_owned(),
        monitor: Arc::new(Mutex::new(Monitor::new(pid))),
        queue: Arc::new(AtomicUsize::new(0)),
    };
    let path = state.paths.recording(&lecture.course_id, id)?;
    // One replaceable preview and two final batches; recording never waits on either.
    let translations = Arc::new(TranslationQueue::default());
    let translator = (settings.live_translation && translation_configured).then(|| {
        TranslationWorker {
            session: session.clone(),
            requests: translations.clone(),
            context: context.clone(),
            language: course.assistance_language.clone(),
            local: settings.translation_mode == ProcessingMode::Local,
        }
        .spawn()
    });
    let mut recognition = Recognition {
        session: session.clone(),
        recognizer,
        engine: settings.speech_provider,
        path,
        context,
        translations: translator.as_ref().map(|_| translations.clone()),
        preview_enabled: translator.is_some()
            && settings.speech_provider == SpeechEngine::Local
            && settings.translation_mode == ProcessingMode::Local,
        progress: Progress::new(lecture.transcribed_until),
    };
    state.live.progressed(lecture.transcribed_until);
    let work = recognition.run();
    translations.close();
    drop(recognition);
    if let Ok(mut status) = state.live.status.lock() {
        status.state = "finalizing".into();
        status.draft = None;
        status.translation_queue = session.queue.load(Ordering::Relaxed);
        if let Ok(segments) = state.storage.latest_segments(id) {
            status.segments = segments;
        }
        let segments = status.segments.clone();
        status
            .translation_previews
            .retain(|p| preview_valid(p, &segments, None));
        status.sequence += 1;
        emit(&status);
    }
    if let Some(translator) = translator {
        let _ = translator.join();
    }
    session.queue.store(0, Ordering::Relaxed);
    if let Ok(mut m) = session.monitor.lock() {
        m.sample(pid);
    }
    session.write_measurements()?;
    work
}

/// Start the configured live English engine with the course glossary.
fn open_recognizer(
    state: &AppState,
    settings: &AppSettings,
    course: &str,
) -> AppResult<Recognizer> {
    if settings.speech_provider == SpeechEngine::Local {
        let mut engine = LocalSpeech::open(
            &state.runtime,
            &model_manager::path(state),
            &state.performance,
        )?;
        let terms = state
            .storage
            .glossary(course)?
            .into_iter()
            .map(|term| term.source)
            .collect::<Vec<_>>();
        engine.set_glossary(&terms)?;
        Ok(Recognizer::Local(engine))
    } else {
        let provider = settings
            .speech_provider
            .cloud()
            .ok_or("Speech provider unavailable.")?;
        Ok(Recognizer::Cloud(OfficialProvider::new(
            provider,
            &settings.chat_model,
        )?))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_delay_tracks_processed_audio_and_translation_age_has_a_bound() {
        let live = Live::default();
        live.progressed(180.0);
        assert_eq!(live.backlog(300.0), 120.0);
        assert_eq!(live.backlog(100.0), 0.0);
        assert!(super::super::translation_worker::translation_is_stale(
            300.0, 180.0
        ));
        assert!(!super::super::translation_worker::translation_is_stale(
            300.0, 290.0
        ));
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
