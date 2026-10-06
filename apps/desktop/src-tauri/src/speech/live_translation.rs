//! Local speculative work is disposable; durable English and final work are separate.
use crate::{
    domain::TranscriptSegment,
    error::{AppResult, UserFacing},
};
use serde::Serialize;
use std::{
    collections::VecDeque,
    sync::{Condvar, Mutex},
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationPreview {
    pub id: String,
    pub source_text: String,
    pub source_revision: u64,
    pub language: String,
    pub translated_text: String,
    pub kind: String,
}
impl TranslationPreview {
    pub fn matches(&self, id: &str, source: &str, language: &str) -> bool {
        self.id == id
            && self.language == language
            && if self.kind == "final" {
                self.source_text == source
            } else {
                prefix_matches(source, &self.source_text)
            }
    }
}
pub fn prefix_matches(source: &str, prefix: &str) -> bool {
    let source = normalize(source);
    let prefix = normalize(prefix);
    !prefix.is_empty()
        && (source == prefix
            || source
                .strip_prefix(&prefix)
                .is_some_and(|rest| rest.starts_with(' ')))
}
fn normalize(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[derive(Default)]
pub struct StablePrefix {
    previous: Vec<String>,
    proposed: String,
    proposed_at_ms: Option<u64>,
    revision: u64,
}
impl StablePrefix {
    /// Require agreement across two hypotheses and leave two trailing words unsettled.
    /// Keep proposals small and infrequent on a shared four-core CPU budget.
    pub fn observe(&mut self, text: &str, now_ms: u64) -> Option<(String, u64)> {
        let words: Vec<_> = text.split_whitespace().map(str::to_owned).collect();
        let common = words
            .iter()
            .zip(&self.previous)
            .take_while(|(a, b)| a == b)
            .count();
        self.previous = words.clone();
        // Twenty seconds of continuous speech can exceed 32 words. Capping the
        // prefix there froze the last half of an utterance until finalization.
        // Bound work by bytes, but keep advancing through the agreed hypothesis.
        let count = common.saturating_sub(2).min(80);
        if count < 6
            || self
                .proposed_at_ms
                .is_some_and(|at| now_ms.saturating_sub(at) < 2500)
        {
            return None;
        }
        let candidate = words[..count].join(" ");
        if candidate.len() > 1024 || candidate == self.proposed {
            return None;
        }
        if prefix_matches(&candidate, &self.proposed)
            && count < self.proposed.split_whitespace().count() + 4
        {
            return None;
        }
        self.proposed = candidate.clone();
        self.proposed_at_ms = Some(now_ms);
        self.revision += 1;
        Some((candidate, self.revision))
    }
}

pub enum Request {
    Final(Vec<TranscriptSegment>),
    Preview(TranscriptSegment),
}
#[derive(Default)]
struct Pending {
    finals: VecDeque<Vec<TranscriptSegment>>,
    preview: Option<TranscriptSegment>,
    closed: bool,
}
#[derive(Default)]
pub struct TranslationQueue {
    pending: Mutex<Pending>,
    wake: Condvar,
}
impl TranslationQueue {
    /// Newest final work wins when overloaded; evicted English remains in SQLite.
    pub fn final_batch(&self, batch: Vec<TranscriptSegment>) -> Option<Vec<TranscriptSegment>> {
        let Ok(mut pending) = self.pending.lock() else {
            return Some(batch);
        };
        if pending.closed {
            return Some(batch);
        }
        pending.preview = None;
        let dropped = if pending.finals.len() == 2 {
            pending.finals.pop_front()
        } else {
            None
        };
        pending.finals.push_back(batch);
        self.wake.notify_one();
        dropped
    }
    pub fn preview(&self, segment: TranscriptSegment) {
        if let Ok(mut pending) = self.pending.lock()
            && !pending.closed
        {
            pending.preview = Some(segment);
            self.wake.notify_one();
        }
    }
    pub fn preview_should_yield(&self) -> bool {
        self.pending
            .lock()
            .map(|p| p.closed || !p.finals.is_empty())
            .unwrap_or(true)
    }
    pub fn next(&self) -> AppResult<Option<Request>> {
        let mut pending = self
            .pending
            .lock()
            .user_error("Live translation queue unavailable.")?;
        loop {
            if let Some(batch) = pending.finals.pop_front() {
                return Ok(Some(Request::Final(batch)));
            }
            if pending.closed {
                return Ok(None);
            }
            if let Some(segment) = pending.preview.take() {
                return Ok(Some(Request::Preview(segment)));
            }
            pending = self
                .wake
                .wait(pending)
                .user_error("Live translation queue unavailable.")?;
        }
    }
    pub fn close(&self) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.closed = true;
            pending.preview = None;
            self.wake.notify_all();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stable_preview_keeps_progressing_after_thirty_two_words() {
        let mut stable = StablePrefix::default();
        let first = (0..40)
            .map(|i| format!("word{i}"))
            .collect::<Vec<_>>()
            .join(" ");
        assert!(stable.observe(&first, 0).is_none());
        assert_eq!(
            stable
                .observe(&first, 1000)
                .unwrap()
                .0
                .split_whitespace()
                .count(),
            38
        );
        let longer = format!("{first} more stable words with continuing explanation today");
        stable.observe(&longer, 2000);
        let next = stable.observe(&longer, 4000).unwrap().0;
        assert!(next.split_whitespace().count() > 40);
    }
    fn segment(text: &str) -> TranscriptSegment {
        TranscriptSegment {
            source_text: text.into(),
            id: text.into(),
            lecture_id: "fixture".into(),
            start_seconds: 0.,
            end_seconds: 1.,
            translated_text: String::new(),
            origin: crate::domain::SegmentOrigin::Local,
            provider: "local".into(),
            status: "final".into(),
            transcript_version: "live".into(),
            revision: 0,
        }
    }
    #[test]
    fn stable_preview_excludes_unsettled_words_throttles_and_resets_revisions() {
        let mut stable = StablePrefix::default();
        assert!(
            stable
                .observe(
                    "This statistical association does not establish causation in our experiment",
                    0
                )
                .is_none()
        );
        let (text, revision) = stable
            .observe(
                "This statistical association does not establish causation in our experiment today",
                800,
            )
            .unwrap();
        assert_eq!(
            text,
            "This statistical association does not establish causation in"
        );
        assert_eq!(revision, 1);
        assert!(stable.observe("This statistical association does not establish causation in our experiment today", 1600).is_none());
        assert!(
            stable
                .observe(
                    "This statistical association does establish causation in our experiment today",
                    4000
                )
                .is_none()
        );
        assert!(!prefix_matches(
            "This statistical association does establish causation",
            &text
        ));
        assert!(
            StablePrefix::default()
                .observe("New sentence", 5000)
                .is_none()
        );
        assert!(!prefix_matches("A neuron changes", "A neuro"));
    }
    #[test]
    fn preview_cannot_survive_changed_source_target_or_final_text() {
        let mut preview = TranslationPreview {
            id: "one".into(),
            source_text: "It does not cause disease".into(),
            source_revision: 1,
            language: "zh".into(),
            translated_text: "不会导致疾病".into(),
            kind: "draft".into(),
        };
        assert!(preview.matches("one", "It does not cause disease in this experiment", "zh"));
        assert!(!preview.matches("one", "It does cause disease in this experiment", "zh"));
        assert!(!preview.matches("other", "It does not cause disease", "zh"));
        assert!(!preview.matches("one", "It does not cause disease", "ja"));
        preview.kind = "final".into();
        assert!(!preview.matches("one", "It does not cause disease in this experiment", "zh"));
    }
    #[test]
    fn latest_preview_is_replaceable_and_final_work_preempts_it() {
        let queue = TranslationQueue::default();
        queue.preview(segment("old"));
        queue.preview(segment("new"));
        let Request::Preview(p) = queue.next().unwrap().unwrap() else {
            panic!("expected preview")
        };
        assert_eq!(p.source_text, "new");
        queue.preview(segment("obsolete"));
        queue.final_batch(vec![segment("final")]);
        assert!(queue.preview_should_yield());
        let Request::Final(batch) = queue.next().unwrap().unwrap() else {
            panic!("expected final")
        };
        assert_eq!(batch[0].source_text, "final");
        queue.close();
        assert!(queue.next().unwrap().is_none());
    }
    #[test]
    fn overload_defers_oldest_final_and_shutdown_drains_only_durable_work() {
        let queue = TranslationQueue::default();
        queue.final_batch(vec![segment("one")]);
        queue.final_batch(vec![segment("two")]);
        assert_eq!(
            queue.final_batch(vec![segment("three")]).unwrap()[0].source_text,
            "one"
        );
        queue.preview(segment("discard on stop"));
        queue.close();
        for expected in ["two", "three"] {
            let Request::Final(batch) = queue.next().unwrap().unwrap() else {
                panic!("expected final")
            };
            assert_eq!(batch[0].source_text, expected);
        }
        assert!(queue.next().unwrap().is_none());
        assert!(queue.final_batch(vec![segment("late")]).is_some());
    }
}
