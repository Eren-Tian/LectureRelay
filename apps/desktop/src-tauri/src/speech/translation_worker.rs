//! The live translation thread. It consumes one replaceable preview and up to
//! two final batches from [`TranslationQueue`]; recording and English captions
//! never wait on it, and anything it skips stays in SQLite for later.

use super::live_translation::{Request, TranslationPreview, TranslationQueue, prefix_matches};
use super::streaming::{LiveSession, LiveStatus};
use crate::{
    AppState,
    domain::TranscriptSegment,
    error::AppResult,
    providers::{LiveTranslationControl, Provider, Role, Translation, configured_text},
};
use std::{
    sync::{Arc, Mutex, atomic::Ordering},
    time::{Duration, Instant},
};
use tauri::Emitter;

pub(super) struct TranslationWorker {
    pub session: LiveSession,
    pub requests: Arc<TranslationQueue>,
    pub context: String,
    pub language: String,
    pub local: bool,
}

impl TranslationWorker {
    pub fn spawn(self) -> std::thread::JoinHandle<()> {
        std::thread::spawn(move || self.run())
    }

    fn run(&self) {
        let state = &self.session.state;
        let Ok(provider) = configured_text(state, Role::Translation, true) else {
            return;
        };
        if self.local {
            self.warm_up(provider.as_ref());
        }
        while let Ok(Some(request)) = self.requests.next() {
            let preview = matches!(request, Request::Preview(_));
            let batch = match request {
                Request::Preview(segment) => vec![segment],
                Request::Final(batch) => batch,
            };
            if state.live.cancelled() {
                if !preview {
                    self.release();
                }
                break;
            }
            if self.should_skip(&batch) {
                self.skip(&batch, preview);
                continue;
            }
            let started = Instant::now();
            self.stage(
                if preview {
                    "preview_start"
                } else {
                    "translation_start"
                },
                &batch,
            );
            if !preview
                && let Ok(mut status) = state.live.status.lock()
                && let Ok(segments) = state.storage.latest_segments(&self.session.id)
            {
                status.segments = segments;
            }
            let result = self.translate(provider.as_ref(), &batch, preview);
            self.stage(
                if preview {
                    "preview_done"
                } else {
                    "translation_done"
                },
                &batch,
            );
            if preview {
                if let Ok(result) = result
                    && !self.superseded(&batch[0])
                    && let Some(value) = result.iter().find(|r| r.id == batch[0].id)
                {
                    self.show(&batch[0], &value.text, true);
                }
                continue;
            }
            match result {
                Ok(_) if state.live.cancelled() => {
                    self.release();
                    break;
                }
                Ok(result) => self.save(&batch, &result, started),
                Err(error) => self.fail(&batch, error),
            }
        }
    }

    fn warm_up(&self, provider: &dyn Provider) {
        self.stage("translation_prepare_start", &[]);
        let warmup = tauri::async_runtime::block_on(async {
            tokio::time::timeout(Duration::from_secs(30), provider.prepare_live())
                .await
                .map_err(|_| "Local model loading timed out. Recording is preserved.".to_string())?
        });
        self.stage(
            if warmup.is_ok() {
                "translation_ready"
            } else {
                "translation_prepare_failed"
            },
            &[],
        );
        if let Err(error) = warmup
            && let Ok(mut status) = self.session.state.live.status.lock()
        {
            status.message = Some(error);
        }
    }

    /// Paused translation, or work too old or too far behind to be useful live.
    fn should_skip(&self, batch: &[TranscriptSegment]) -> bool {
        let live = &self.session.state.live;
        let recording = self.session.state.recorder.status().ok().flatten();
        live.translation_paused()
            || recording.as_ref().is_some_and(|r| {
                translation_is_stale(
                    r.duration_seconds,
                    batch.last().map(|s| s.end_seconds).unwrap_or(0.0),
                ) || live.backlog(r.duration_seconds) > 6.0
            })
    }

    fn skip(&self, batch: &[TranscriptSegment], preview: bool) {
        if !preview {
            self.release();
        }
        if let Ok(mut s) = self.session.state.live.status.lock() {
            if !preview {
                for segment in batch {
                    s.translation.complete(&segment.id, false);
                }
            }
            s.translation_queue = self.session.queue.load(Ordering::Relaxed);
            s.sequence += 1;
            let _ = self.session.app.emit("live-status", &*s);
        }
    }

    fn translate(
        &self,
        provider: &dyn Provider,
        batch: &[TranscriptSegment],
        preview: bool,
    ) -> AppResult<Vec<Translation>> {
        let superseded = || preview && self.superseded(&batch[0]);
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
            if self.show(segment, text, preview) {
                *last = Some(Instant::now());
                if first {
                    self.stage(
                        if preview {
                            "preview_first_delta"
                        } else {
                            "translation_first_delta"
                        },
                        std::slice::from_ref(segment),
                    );
                }
            }
        };
        tauri::async_runtime::block_on(async {
            tokio::time::timeout(
                Duration::from_secs(if self.local { 30 } else { 20 }),
                async {
                    if self.local {
                        provider
                            .translate_live(
                                &self.context,
                                batch,
                                &self.language,
                                LiveTranslationControl {
                                    progress: &progress,
                                    superseded: &superseded,
                                    preview,
                                },
                            )
                            .await
                    } else {
                        provider
                            .translate(&self.context, batch, &self.language)
                            .await
                    }
                },
            )
            .await
            .map_err(|_| "Live translation timed out. English is preserved.".to_string())?
        })
    }

    /// A preview yields to queued final work, to stopping, and to English
    /// that no longer starts with the previewed text.
    fn superseded(&self, segment: &TranscriptSegment) -> bool {
        let live = &self.session.state.live;
        self.requests.preview_should_yield()
            || live.finishing()
            || !live
                .status
                .lock()
                .is_ok_and(|status| request_valid(&status, segment, true))
    }

    fn save(&self, batch: &[TranscriptSegment], result: &[Translation], started: Instant) {
        let session = &self.session;
        let saved = super::translation_progress::persist(
            &session.state.storage,
            &session.id,
            batch,
            result,
            &self.language,
        );
        if let Ok(mut m) = session.monitor.lock() {
            m.translation(started.elapsed().as_secs_f64() * 1000.0);
        }
        self.release();
        if let Ok(mut s) = session.state.live.status.lock() {
            for (segment_id, saved) in saved {
                s.translation.complete(&segment_id, saved);
            }
            if let Ok(segments) = session.state.storage.latest_segments(&session.id) {
                s.segments = segments;
            }
            s.translation_previews
                .retain(|p| !batch.iter().any(|s| s.id == p.id));
            s.translation_queue = session.queue.load(Ordering::Relaxed);
            s.sequence += 1;
            let _ = session.app.emit("live-status", &*s);
            self.stage("translation_published", batch);
        }
    }

    fn fail(&self, batch: &[TranscriptSegment], error: String) {
        self.release();
        if let Ok(mut s) = self.session.state.live.status.lock() {
            s.message = Some(error);
            for segment in batch {
                s.translation.complete(&segment.id, false);
            }
            s.translation_previews
                .retain(|p| !batch.iter().any(|s| s.id == p.id));
            s.translation_queue = self.session.queue.load(Ordering::Relaxed);
            s.sequence += 1;
            let _ = self.session.app.emit("live-status", &*s);
        }
    }

    /// One final batch left the queue.
    fn release(&self) {
        self.session.queue.fetch_sub(1, Ordering::Relaxed);
    }

    fn show(&self, segment: &TranscriptSegment, text: &str, preview: bool) -> bool {
        show_translation_preview(
            &self.session.state,
            &self.session.app,
            segment,
            &self.language,
            text,
            preview,
        )
    }

    fn stage(&self, stage: &str, batch: &[TranscriptSegment]) {
        crate::diagnostics::caption_stage(
            &self.session.state.paths,
            &self.session.id,
            stage,
            batch,
            0.0,
        );
    }
}

/// Queue finalized English for translation. Paused or overflowing work is
/// marked untranslated immediately; English and audio are already saved.
pub(super) fn enqueue_translation(
    state: &AppState,
    sender: &TranslationQueue,
    queue: &std::sync::atomic::AtomicUsize,
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

pub(super) fn request_valid(
    status: &LiveStatus,
    segment: &TranscriptSegment,
    preview: bool,
) -> bool {
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

pub(super) fn translation_is_stale(recorded_seconds: f64, segment_end: f64) -> bool {
    recorded_seconds - segment_end > 16.0
}
