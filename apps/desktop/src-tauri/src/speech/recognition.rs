//! The live English recognition loop. It tails the checkpointed recording,
//! feeds the local worker (or rolling cloud requests), saves finals and hands
//! them to translation. Recording never waits on it; audio it does not reach
//! before Stop remains for postclass transcription.

use super::live_translation::{StablePrefix, TranslationQueue};
use super::streaming::{Draft, LiveSession};
use super::translation_worker::enqueue_translation;
use crate::{
    domain::{SegmentOrigin, SpeechEngine, TranscriptSegment},
    error::{AppResult, UserFacing},
    providers::{OfficialProvider, SpeechSegment, TranscriptionProvider},
    speech::local::worker::LocalSpeech,
};
use std::{
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};

/// Backlog beyond which captions warn, and Stop leaves the rest for later.
const BEHIND_SECONDS: f64 = 12.0;

/// Exactly one live English engine.
pub(super) enum Recognizer {
    Local(LocalSpeech),
    Cloud(OfficialProvider),
}

impl Recognizer {
    pub fn process_id(&self) -> Option<u32> {
        match self {
            Self::Local(engine) => Some(engine.process_id()),
            Self::Cloud(_) => None,
        }
    }

    /// Two native 160 ms blocks locally; cloud keeps its rolling batch policy.
    fn chunk_seconds(&self) -> f64 {
        match self {
            Self::Local(_) => 0.32,
            Self::Cloud(_) => 2.0,
        }
    }
}

/// Where the loop is in the recording. Owned by [`Recognition`].
pub(super) struct Progress {
    cursor: f64,
    utterance_start: f64,
    stable_prefix: StablePrefix,
    preview_clock: Instant,
    last_sample: Instant,
    last_write: Instant,
    failures: u32,
}

impl Progress {
    /// Resume after audio already transcribed for this lecture.
    pub fn new(transcribed_until: f64) -> Self {
        Self {
            cursor: transcribed_until,
            utterance_start: transcribed_until,
            stable_prefix: StablePrefix::default(),
            preview_clock: Instant::now(),
            last_sample: Instant::now(),
            last_write: Instant::now(),
            failures: 0,
        }
    }
}

pub(super) struct Recognition {
    pub session: LiveSession,
    pub recognizer: Recognizer,
    /// Provenance recorded on saved segments.
    pub engine: SpeechEngine,
    pub path: PathBuf,
    pub context: String,
    /// Present while a translation worker consumes finals.
    pub translations: Option<Arc<TranslationQueue>>,
    pub preview_enabled: bool,
    pub progress: Progress,
}

enum Flow {
    Continue,
    Stop,
}

/// What to do with audio not yet recognized.
#[derive(Debug, PartialEq)]
enum Schedule {
    /// Too little new audio; poll again shortly.
    Wait,
    /// Stopping with no audio left: flush the open utterance and end.
    Flush,
    /// Recognize this many seconds.
    Read(f64),
}

fn schedule(backlog: f64, chunk: f64, finishing: bool) -> Schedule {
    if backlog < chunk && !finishing {
        Schedule::Wait
    } else if backlog < 0.05 {
        Schedule::Flush
    } else {
        Schedule::Read(backlog.min(chunk))
    }
}

enum Heard {
    /// Provisional local text for the open utterance.
    Partial(String),
    /// Finalized speech, timed relative to the utterance start.
    Final(Vec<SpeechSegment>),
}

impl Recognition {
    pub fn run(&mut self) -> AppResult<()> {
        while let Flow::Continue = self.step()? {}
        Ok(())
    }

    fn step(&mut self) -> AppResult<Flow> {
        let live = &self.session.state.live;
        if live.cancelled() {
            return Ok(Flow::Stop);
        }
        let finishing = live.finishing();
        let Ok(mut reader) = hound::WavReader::open(&self.path) else {
            if finishing {
                return Ok(Flow::Stop);
            }
            std::thread::sleep(Duration::from_millis(100));
            return Ok(Flow::Continue);
        };
        let spec = reader.spec();
        if spec.sample_rate == 0 || spec.channels != 1 || spec.bits_per_sample != 16 {
            return Err("Unsupported live audio format.".into());
        }
        let rate = spec.sample_rate as f64;
        let duration = reader.duration() as f64 / rate;
        let backlog = (duration - self.progress.cursor).max(0.0);
        self.record_diagnostics()?;
        let span = match schedule(backlog, self.recognizer.chunk_seconds(), finishing) {
            Schedule::Wait => {
                std::thread::sleep(Duration::from_millis(100));
                return Ok(Flow::Continue);
            }
            Schedule::Flush => {
                self.flush_utterance()?;
                return Ok(Flow::Stop);
            }
            Schedule::Read(span) => span,
        };
        reader
            .seek((self.progress.cursor * rate).round() as u32)
            .user_error("Cannot read live audio checkpoint.")?;
        let samples = reader
            .samples::<i16>()
            .take((span * rate).round() as usize)
            .collect::<hound::Result<Vec<_>>>()
            .user_error("Cannot read live audio. Recording continues.")?;
        if samples.is_empty() {
            return Ok(if finishing {
                Flow::Stop
            } else {
                Flow::Continue
            });
        }
        let end = self.progress.cursor + samples.len() as f64 / rate;
        let base = match self.recognizer {
            Recognizer::Local(_) => self.progress.utterance_start,
            Recognizer::Cloud(_) => self.progress.cursor,
        };
        self.session.publish(
            backlog,
            Some(self.processing_draft(base, end)),
            behind_warning(backlog),
        )?;
        let started = Instant::now();
        self.stage("speech_start", &[], end);
        let heard = match self.recognize(&samples, spec, base, end, backlog, finishing) {
            Ok(heard) => {
                self.progress.failures = 0;
                heard
            }
            Err(error) => {
                self.progress.failures += 1;
                self.session.publish(backlog, None, Some(error.clone()))?;
                if matches!(self.recognizer, Recognizer::Local(_))
                    || finishing
                    || self.progress.failures >= 3
                {
                    return Err(error);
                }
                std::thread::sleep(Duration::from_secs(2));
                return Ok(Flow::Continue);
            }
        };
        if let Ok(mut monitor) = self.session.monitor.lock() {
            monitor.stt(started.elapsed().as_secs_f64() * 1000.0);
        }
        match heard {
            Heard::Partial(text) => {
                self.on_partial(text, base, end, duration, finishing)?;
                Ok(Flow::Continue)
            }
            Heard::Final(response) => {
                let segments = final_segments(&self.session.id, self.engine, base, end, response)?;
                self.on_final(segments, end, duration)?;
                // Disk-backed backlog is bounded in memory. Stop leaves any remaining audio for post-stop STT.
                Ok(if finishing && backlog > BEHIND_SECONDS {
                    Flow::Stop
                } else {
                    Flow::Continue
                })
            }
        }
    }

    /// Five-second resource samples and a performance file every 30 seconds.
    fn record_diagnostics(&mut self) -> AppResult<()> {
        let state = &self.session.state;
        if self.progress.last_sample.elapsed() >= Duration::from_secs(5) {
            if let Ok(mut m) = self.session.monitor.lock() {
                m.sample(self.recognizer.process_id());
                if let Some(recording) = state.recorder.status()? {
                    m.data.dropped_chunks = recording.dropped_chunks;
                    m.data.dropped_buffers = recording.quality.dropped_buffers;
                    m.data.dropped_samples = recording.quality.dropped_samples;
                    m.data.device_discontinuities = recording.quality.device_discontinuities;
                }
            }
            self.progress.last_sample = Instant::now();
        }
        if self.progress.last_write.elapsed() >= Duration::from_secs(30) {
            self.session.write_measurements()?;
            self.progress.last_write = Instant::now();
        }
        Ok(())
    }

    /// The caption placeholder while a chunk is recognized keeps the last partial text.
    fn processing_draft(&self, base: f64, end: f64) -> Draft {
        Draft {
            id: utterance_id(&self.session.id, base),
            start_seconds: base,
            end_seconds: end,
            partial_text: self
                .session
                .state
                .live
                .status
                .lock()
                .ok()
                .and_then(|s| s.draft.as_ref().map(|d| d.partial_text.clone()))
                .unwrap_or_default(),
            status: "partial".into(),
        }
    }

    fn recognize(
        &mut self,
        samples: &[i16],
        spec: hound::WavSpec,
        base: f64,
        end: f64,
        backlog: f64,
        finishing: bool,
    ) -> AppResult<Heard> {
        let chunk = self.recognizer.chunk_seconds();
        match &mut self.recognizer {
            Recognizer::Local(engine) => {
                let mut update = engine.feed(samples, spec.sample_rate)?;
                if !update.is_final && finishing && backlog <= chunk + 0.05 {
                    update = engine.finish()?;
                }
                Ok(if update.is_final {
                    Heard::Final(vec![SpeechSegment {
                        start: 0.0,
                        end: end - base,
                        text: update.text,
                    }])
                } else {
                    Heard::Partial(update.text)
                })
            }
            Recognizer::Cloud(provider) => {
                // Never infer on near-silence: this reduces fan load and silence hallucinations.
                if samples.iter().all(|s| s.unsigned_abs() < 120) {
                    return Ok(Heard::Final(Vec::new()));
                }
                let wav = crate::audio::wav::encode_chunk(samples, spec)?;
                tauri::async_runtime::block_on(async {
                    tokio::time::timeout(
                        Duration::from_secs(15),
                        provider.transcribe(wav, &self.context),
                    )
                    .await
                    .map_err(|_| "Live transcription timed out. Recording continues.".to_string())?
                })
                .map(Heard::Final)
            }
        }
    }

    fn on_partial(
        &mut self,
        text: String,
        base: f64,
        end: f64,
        duration: f64,
        finishing: bool,
    ) -> AppResult<()> {
        let id = &self.session.id;
        let state = &self.session.state;
        self.progress.cursor = end;
        state.live.progressed(end);
        self.stage(
            "speech_partial",
            &[local_segment(id, base, end, text.clone())],
            end,
        );
        self.session.publish(
            (duration - end).max(0.0),
            Some(Draft {
                id: utterance_id(id, base),
                start_seconds: base,
                end_seconds: end,
                partial_text: text.clone(),
                status: "partial".into(),
            }),
            None,
        )?;
        if self.preview_enabled
            && !finishing
            && !state.live.translation_paused()
            && state.live.backlog(duration) <= 3.0
            && let Some(translations) = &self.translations
            && let Some((source, revision)) = self.progress.stable_prefix.observe(
                &text,
                self.progress.preview_clock.elapsed().as_millis() as u64,
            )
        {
            let mut segment = local_segment(id, base, end, source);
            segment.revision = revision as i64;
            self.stage("preview_eligible", std::slice::from_ref(&segment), end);
            translations.preview(segment);
        }
        Ok(())
    }

    fn on_final(
        &mut self,
        segments: Vec<TranscriptSegment>,
        end: f64,
        duration: f64,
    ) -> AppResult<()> {
        let state = &self.session.state;
        state
            .storage
            .append_cloud_chunk(&self.session.id, &segments, end)?;
        self.stage("speech_final", &segments, end);
        self.progress.cursor = end;
        state.live.progressed(end);
        self.progress.utterance_start = end;
        self.progress.stable_prefix = StablePrefix::default();
        self.translate(segments);
        self.session.publish((duration - end).max(0.0), None, None)
    }

    /// On Stop, finalize the open local utterance so no recognized words are lost.
    fn flush_utterance(&mut self) -> AppResult<()> {
        let Progress {
            cursor,
            utterance_start,
            ..
        } = self.progress;
        let Recognizer::Local(engine) = &mut self.recognizer else {
            return Ok(());
        };
        if cursor <= utterance_start {
            return Ok(());
        }
        let update = engine.finish()?;
        let segments = if update.text.trim().is_empty() {
            vec![]
        } else {
            vec![local_segment(
                &self.session.id,
                utterance_start,
                cursor,
                update.text,
            )]
        };
        self.session
            .state
            .storage
            .append_cloud_chunk(&self.session.id, &segments, cursor)?;
        self.translate(segments);
        Ok(())
    }

    fn translate(&self, segments: Vec<TranscriptSegment>) {
        if !segments.is_empty()
            && let Some(translations) = &self.translations
        {
            enqueue_translation(
                &self.session.state,
                translations,
                &self.session.queue,
                segments,
            );
        }
    }

    fn stage(&self, stage: &str, segments: &[TranscriptSegment], end: f64) {
        crate::diagnostics::caption_stage(
            &self.session.state.paths,
            &self.session.id,
            stage,
            segments,
            end,
        );
    }
}

fn behind_warning(backlog: f64) -> Option<String> {
    (backlog > BEHIND_SECONDS).then(|| {
        "English captions are behind. Audio is still being saved. Try Full performance; remaining text can be transcribed after class.".into()
    })
}

fn utterance_id(lecture: &str, start: f64) -> String {
    format!("{lecture}:{}", (start * 1000.0).round() as u64)
}

/// Validate recognized speech and place it on the lecture timeline.
fn final_segments(
    lecture: &str,
    engine: SpeechEngine,
    base: f64,
    end: f64,
    response: Vec<SpeechSegment>,
) -> AppResult<Vec<TranscriptSegment>> {
    let span = end - base;
    let mut segments = Vec::new();
    for (index, s) in response.into_iter().enumerate() {
        if s.text.trim().is_empty() {
            continue;
        }
        if !s.start.is_finite() || !s.end.is_finite() || s.end < s.start || s.text.len() > 10000 {
            return Err("Invalid live speech response. Audio is preserved.".into());
        }
        let start = s.start.clamp(0.0, span);
        let finish = s.end.clamp(start, span);
        segments.push(TranscriptSegment {
            id: format!("{}:{index}", utterance_id(lecture, base)),
            lecture_id: lecture.into(),
            start_seconds: base + start,
            end_seconds: base + finish,
            source_text: s.text.trim().into(),
            translated_text: String::new(),
            origin: if engine == SpeechEngine::Local {
                SegmentOrigin::Local
            } else {
                SegmentOrigin::Cloud
            },
            provider: engine.as_str().into(),
            status: "final".into(),
            transcript_version: "live".into(),
            revision: 0,
        });
    }
    Ok(segments)
}

pub(super) fn local_segment(id: &str, start: f64, end: f64, text: String) -> TranscriptSegment {
    TranscriptSegment {
        id: format!("{}:0", utterance_id(id, start)),
        lecture_id: id.into(),
        start_seconds: start,
        end_seconds: end,
        source_text: text,
        translated_text: String::new(),
        origin: SegmentOrigin::Local,
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
    fn schedule_waits_for_a_chunk_and_drains_everything_on_stop() {
        assert_eq!(schedule(0.2, 0.32, false), Schedule::Wait);
        assert_eq!(schedule(5.0, 0.32, false), Schedule::Read(0.32));
        assert_eq!(schedule(5.0, 2.0, false), Schedule::Read(2.0));
        // Stopping reads a short tail instead of waiting for a full chunk.
        assert_eq!(schedule(0.2, 0.32, true), Schedule::Read(0.2));
        assert_eq!(schedule(0.01, 0.32, true), Schedule::Flush);
        // Never flush mid-lecture just because no new audio arrived yet.
        assert_eq!(schedule(0.0, 0.32, false), Schedule::Wait);
    }

    #[test]
    fn final_segments_are_clamped_to_the_chunk_and_keep_provenance() {
        let response = vec![
            SpeechSegment {
                start: -1.0,
                end: 0.5,
                text: " First words. ".into(),
            },
            SpeechSegment {
                start: 0.5,
                end: 0.5,
                text: "   ".into(),
            },
            SpeechSegment {
                start: 1.0,
                end: 99.0,
                text: "Overlong timing".into(),
            },
        ];
        let segments = final_segments("lec", SpeechEngine::Groq, 10.0, 12.0, response).unwrap();
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].id, "lec:10000:0");
        assert_eq!(segments[0].source_text, "First words.");
        assert_eq!(
            (segments[0].start_seconds, segments[0].end_seconds),
            (10.0, 10.5)
        );
        assert_eq!(segments[1].id, "lec:10000:2");
        assert_eq!(segments[1].end_seconds, 12.0);
        assert_eq!(segments[1].origin, SegmentOrigin::Cloud);
        assert_eq!(segments[1].provider, "groq");
        let local = final_segments(
            "lec",
            SpeechEngine::Local,
            0.0,
            1.0,
            vec![SpeechSegment {
                start: 0.0,
                end: 1.0,
                text: "Local".into(),
            }],
        )
        .unwrap();
        assert_eq!(local[0].origin, SegmentOrigin::Local);
    }

    #[test]
    fn invalid_speech_timing_is_rejected_without_saving_anything() {
        for (start, end) in [(f64::NAN, 1.0), (0.0, f64::INFINITY), (2.0, 1.0)] {
            let response = vec![SpeechSegment {
                start,
                end,
                text: "text".into(),
            }];
            assert!(final_segments("lec", SpeechEngine::OpenAi, 0.0, 2.0, response).is_err());
        }
    }

    #[test]
    fn captions_warn_only_when_meaningfully_behind() {
        assert!(behind_warning(12.0).is_none());
        assert!(behind_warning(12.5).unwrap().contains("behind"));
    }
}
