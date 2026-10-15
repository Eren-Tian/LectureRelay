//! Owns bounded scheduling, final-batch accounting and durable delivery outcomes.
//! A dropped request is deferred exactly once, including cancellation and panic.
use super::{
    live_translation::{Request, TranslationQueue},
    translation_progress::{TranslationProgress, persist},
};
use crate::{
    database::Storage,
    domain::TranscriptSegment,
    error::{AppResult, UserFacing},
    providers::Translation,
};
use std::{collections::HashMap, sync::Mutex};

#[derive(Default)]
struct Ledger {
    batches: HashMap<String, Vec<String>>,
    progress: TranslationProgress,
    closed: bool,
}

pub(crate) struct TranslationDelivery {
    queue: TranslationQueue,
    ledger: Mutex<Ledger>,
}
impl TranslationDelivery {
    pub fn new(enabled: bool, configured: bool) -> Self {
        Self {
            queue: TranslationQueue::default(),
            ledger: Mutex::new(Ledger {
                progress: TranslationProgress {
                    enabled,
                    configured,
                    ..Default::default()
                },
                ..Default::default()
            }),
        }
    }
    pub fn enqueue(&self, batch: Vec<TranscriptSegment>, paused: bool) {
        let Some(first) = batch.first() else {
            return;
        };
        let Ok(mut ledger) = self.ledger.lock() else {
            return;
        };
        if paused || ledger.closed {
            for segment in &batch {
                ledger.progress.complete(&segment.id, false);
            }
            return;
        }
        if ledger.batches.contains_key(&first.id) {
            return;
        }
        for segment in &batch {
            ledger.progress.pending(&segment.id);
        }
        ledger.batches.insert(
            first.id.clone(),
            batch.iter().map(|s| s.id.clone()).collect(),
        );
        if let Some(dropped) = self.queue.final_batch(batch) {
            Self::complete(&mut ledger, &dropped, &[]);
        }
    }
    pub fn preview(&self, segment: TranscriptSegment) {
        self.queue.preview(segment);
    }
    pub fn preview_should_yield(&self) -> bool {
        self.queue.preview_should_yield()
    }
    pub fn next(&self) -> AppResult<Option<DeliveryRequest<'_>>> {
        Ok(self.queue.next()?.map(|request| DeliveryRequest {
            owner: self,
            request,
        }))
    }
    pub fn snapshot(&self) -> AppResult<(usize, TranslationProgress)> {
        let ledger = self
            .ledger
            .lock()
            .user_error(crate::error::ErrorCode::LiveTranslationQueueUnavailable)?;
        Ok((ledger.batches.len(), ledger.progress.clone()))
    }
    pub fn defer(&self, batch: &[TranscriptSegment]) {
        if let Ok(mut ledger) = self.ledger.lock() {
            Self::complete(&mut ledger, batch, &[]);
        }
    }
    fn complete(ledger: &mut Ledger, batch: &[TranscriptSegment], saved: &[(String, bool)]) {
        let Some(first) = batch.first() else {
            return;
        };
        let Some(ids) = ledger.batches.remove(&first.id) else {
            return;
        };
        for id in ids {
            ledger
                .progress
                .complete(&id, saved.iter().any(|(key, ok)| key == &id && *ok));
        }
    }
    /// Reject new work but drain existing final requests.
    pub fn close(&self) {
        if let Ok(mut ledger) = self.ledger.lock() {
            ledger.closed = true;
        }
        self.queue.close();
    }
    /// Called after the consumer exits. Unsent or abandoned English remains retryable.
    pub fn finish(&self) {
        self.close();
        if let Ok(mut ledger) = self.ledger.lock() {
            ledger.batches.clear();
            ledger.progress.finish();
        }
    }
}

pub(crate) struct DeliveryRequest<'a> {
    owner: &'a TranslationDelivery,
    request: Request,
}
impl DeliveryRequest<'_> {
    pub fn preview(&self) -> bool {
        matches!(self.request, Request::Preview(_))
    }
    pub fn batch(&self) -> &[TranscriptSegment] {
        match &self.request {
            Request::Final(batch) => batch,
            Request::Preview(segment) => std::slice::from_ref(segment),
        }
    }
    pub fn save(
        &self,
        storage: &Storage,
        lecture: &str,
        translations: &[Translation],
        language: &str,
    ) {
        let Ok(mut ledger) = self.owner.ledger.lock() else {
            return;
        };
        if self.preview()
            || !self
                .batch()
                .first()
                .is_some_and(|s| ledger.batches.contains_key(&s.id))
        {
            return;
        }
        let saved = persist(storage, lecture, self.batch(), translations, language);
        TranslationDelivery::complete(&mut ledger, self.batch(), &saved);
    }
}
impl Drop for DeliveryRequest<'_> {
    fn drop(&mut self) {
        if !self.preview() {
            self.owner.defer(self.batch());
        }
    }
}
