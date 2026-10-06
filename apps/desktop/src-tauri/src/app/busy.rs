//! The single place that decides which concurrent work blocks an operation.
//!
//! Commands take the gate, then call [`AppState::ensure_idle`] with the
//! operation they perform. Adding a new kind of background work means adding a
//! [`Busy`] variant and deciding, per [`Operation`], whether it blocks.

use super::AppState;
use crate::error::AppResult;
use std::sync::{MutexGuard, PoisonError, atomic::Ordering};

/// Work that can make another operation unsafe while it runs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Busy {
    Recording,
    LiveCaptions,
    Job,
    Summary,
    ModelDownload,
    AudioTest,
}

impl Busy {
    fn active(self, state: &AppState) -> AppResult<bool> {
        Ok(match self {
            Self::Recording => state.recorder.status()?.is_some(),
            Self::LiveCaptions => state.live.active(),
            Self::Job => state.jobs.status()?.is_some(),
            Self::Summary => state.summaries.busy(),
            Self::ModelDownload => crate::models::manager::downloading(state)?,
            Self::AudioTest => state.audio_preview.load(Ordering::Relaxed),
        })
    }

    fn message(self) -> &'static str {
        match self {
            Self::Recording => "Stop and save the recording first.",
            Self::LiveCaptions => "Wait for live caption processing to finish.",
            Self::Job => "Another AI task is running. Wait or cancel it.",
            Self::Summary => {
                "A live summary is being processed. Wait for it to finish or turn summaries off."
            }
            Self::ModelDownload => "Wait for the model download to finish.",
            Self::AudioTest => "Wait for the five-second audio test to finish.",
        }
    }
}

/// An operation whose safety depends on what else is running.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Operation {
    /// Owns the audio device and starts the speech worker.
    StartRecording,
    /// Opens the selected device for five seconds.
    AudioTest,
    /// An exclusive postclass AI task, media import or provider test. Live
    /// summaries do not block it: they are cloud-only and work on snapshots.
    Job,
    /// Rewrites transcript segments that live captions and jobs also write.
    EditTranscript,
    /// Changes provider/model preferences that live and job work read at start.
    ChangePreferences,
    /// Downloads or removes model files that live and job work load. Cloud
    /// live summaries use no local model.
    ManageModels,
    /// Moves a course to Trash; recordings and jobs of other courses may continue.
    TrashCourse,
    /// Permanently deletes classroom files or models that any work may hold.
    DeleteData,
}

impl Operation {
    pub(crate) fn blocked_by(self) -> &'static [Busy] {
        use Busy::*;
        match self {
            Self::StartRecording => &[AudioTest, Recording, LiveCaptions, Job, ModelDownload],
            Self::AudioTest => &[Recording, LiveCaptions, Job],
            Self::Job => &[Recording, LiveCaptions, ModelDownload, Job],
            Self::EditTranscript => &[LiveCaptions, Job],
            Self::ChangePreferences => &[Recording, LiveCaptions, Job, ModelDownload],
            Self::ManageModels => &[Recording, LiveCaptions, Job, ModelDownload],
            Self::TrashCourse => &[LiveCaptions, Summary],
            Self::DeleteData => &[
                Summary,
                Recording,
                Job,
                LiveCaptions,
                AudioTest,
                ModelDownload,
            ],
        }
    }
}

impl AppState {
    /// Serializes state-changing commands. The gate guards no data, so a panic
    /// in another command cannot leave anything inconsistent: recover from
    /// poisoning instead of reporting "busy" until the app restarts.
    pub(crate) fn lock_gate(&self) -> MutexGuard<'_, ()> {
        self.gate.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Rejects `operation` while any work it conflicts with is running.
    /// Call while holding [`Self::lock_gate`] so the answer stays true.
    pub(crate) fn ensure_idle(&self, operation: Operation) -> AppResult<()> {
        for busy in operation.blocked_by() {
            if busy.active(self)? {
                return Err(busy.message().into());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_operation_names_each_busy_kind_at_most_once() {
        use Operation::*;
        for operation in [
            StartRecording,
            AudioTest,
            Job,
            EditTranscript,
            ChangePreferences,
            ManageModels,
            TrashCourse,
            DeleteData,
        ] {
            let kinds = operation.blocked_by();
            for (index, kind) in kinds.iter().enumerate() {
                assert!(!kinds[index + 1..].contains(kind), "{operation:?}");
            }
        }
        // Deletion must wait for every kind of work.
        assert_eq!(DeleteData.blocked_by().len(), 6);
    }
}
