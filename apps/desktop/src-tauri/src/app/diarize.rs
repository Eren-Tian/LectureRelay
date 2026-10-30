//! Automatic speaker labels. The local Sortformer model finds who spoke when,
//! and each transcript segment takes the speaker it overlaps most.
use crate::{
    AppState,
    domain::TranscriptSegment,
    error::{AppResult, UserFacing},
    models::{catalog, manager},
    speech::local::worker::{LocalSpeech, SpeakerTurn},
};
use std::sync::Arc;

/// Seconds of audio per push; the worker accepts up to a minute.
const CHUNK_SECONDS: u32 = 20;

/// The speaker number for each segment that overlaps any turn. Numbers follow
/// the order in which speakers first appear, so "Speaker 1" talks first.
pub fn assign(segments: &[TranscriptSegment], turns: &[SpeakerTurn]) -> Vec<(String, usize)> {
    let mut order: Vec<i32> = Vec::new();
    let mut labels = Vec::new();
    for segment in segments {
        let mut overlaps: Vec<(i32, f64)> = Vec::new();
        for turn in turns {
            let overlap = segment.end_seconds.min(turn.end) - segment.start_seconds.max(turn.start);
            if overlap <= 0.0 {
                continue;
            }
            match overlaps
                .iter_mut()
                .find(|(speaker, _)| *speaker == turn.speaker)
            {
                Some((_, total)) => *total += overlap,
                None => overlaps.push((turn.speaker, overlap)),
            }
        }
        let Some((speaker, _)) = overlaps.into_iter().max_by(|a, b| a.1.total_cmp(&b.1)) else {
            continue;
        };
        let number = match order.iter().position(|known| *known == speaker) {
            Some(index) => index + 1,
            None => {
                order.push(speaker);
                order.len()
            }
        };
        labels.push((segment.id.clone(), number));
    }
    labels
}

/// Labels a saved lecture's transcript; returns how many speakers were found.
/// `prefix` names them ("Speaker 1"); labels the student typed are kept.
pub async fn run(state: Arc<AppState>, id: String, prefix: String) -> AppResult<usize> {
    if !manager::status_for(&state, catalog::DIARIZATION)?.installed {
        return Err(crate::error::ErrorCode::DownloadTheSpeakerModelFirst.into());
    }
    let segments = state.storage.segments(&id)?;
    if segments.is_empty() {
        return Err(crate::error::ErrorCode::TranscribeBeforeDetectingSpeakers.into());
    }
    let lecture = state.storage.lecture(&id)?;
    let recording = state.paths.recording(&lecture.course_id, &id)?;
    let model = manager::path_for(&state, catalog::DIARIZATION)?;
    let worker_state = state.clone();
    let turns = tauri::async_runtime::spawn_blocking(move || -> AppResult<Vec<SpeakerTurn>> {
        let state = worker_state;
        let mut reader = hound::WavReader::open(&recording)
            .user_error(crate::error::ErrorCode::CannotReadLocalSpeechAudio)?;
        let spec = reader.spec();
        if spec.channels != 1 || spec.bits_per_sample != 16 || spec.sample_rate == 0 {
            return Err(crate::error::ErrorCode::UnsupportedLocalSpeechAudio.into());
        }
        let total = reader.duration() / spec.sample_rate;
        let mut engine = LocalSpeech::open_diarizer(&state.runtime, &model, &state.performance)
            .user_error(crate::error::ErrorCode::SpeakerDetectionFailedTranscriptIsUnchanged)?;
        let size = (spec.sample_rate * CHUNK_SECONDS) as usize;
        let mut chunk = Vec::with_capacity(size);
        let mut done = 0;
        for sample in reader.samples::<i16>() {
            chunk.push(sample.user_error(crate::error::ErrorCode::CannotReadLocalSpeechAudio)?);
            if chunk.len() == size {
                state.jobs.checkpoint()?;
                engine.diarize_feed(&chunk, spec.sample_rate).user_error(
                    crate::error::ErrorCode::SpeakerDetectionFailedTranscriptIsUnchanged,
                )?;
                chunk.clear();
                done += CHUNK_SECONDS;
                state.jobs.progress(done.min(total), total);
            }
        }
        if !chunk.is_empty() {
            engine
                .diarize_feed(&chunk, spec.sample_rate)
                .user_error(crate::error::ErrorCode::SpeakerDetectionFailedTranscriptIsUnchanged)?;
        }
        state.jobs.checkpoint()?;
        engine
            .diarize_finish()
            .user_error(crate::error::ErrorCode::SpeakerDetectionFailedTranscriptIsUnchanged)
    })
    .await
    .user_error(crate::error::ErrorCode::SpeakerDetectionFailedTranscriptIsUnchanged)??;
    let labels = assign(&segments, &turns);
    let speakers = labels.iter().map(|(_, n)| *n).max().unwrap_or(0);
    state.storage.apply_auto_speakers(
        &id,
        &prefix,
        &labels
            .into_iter()
            .map(|(segment, number)| (segment, format!("{prefix} {number}")))
            .collect::<Vec<_>>(),
    )?;
    Ok(speakers)
}
