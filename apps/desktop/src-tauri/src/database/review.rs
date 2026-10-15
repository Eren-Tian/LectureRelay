use super::Storage;
use crate::{
    domain::{new_id, now},
    error::{AppResult, UserFacing},
};
use rusqlite::{OptionalExtension, params};
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPart {
    #[serde(default)]
    pub start_seconds: Option<f64>,
    #[serde(default)]
    pub end_seconds: Option<f64>,
    pub source: String,
    pub depth: u8,
    pub body: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCheckpoint {
    pub id: String,
    pub lecture_id: String,
    pub fingerprint: String,
    pub request: String,
    pub source_version: String,
    pub language: String,
    pub origin: String,
    pub parts: Vec<ReviewPart>,
    /// Reduction levels contain complete results only, in source order.
    pub levels: Vec<Vec<String>>,
    pub recoveries: u32,
    pub state: String,
    pub message: String,
    pub published_version: Option<String>,
}

impl Storage {
    pub fn reviews(&self, lecture: &str) -> AppResult<Vec<ReviewCheckpoint>> {
        let db = self.lock()?;
        let mut q = db.prepare("SELECT payload FROM review_checkpoints WHERE lecture_id=?1 ORDER BY updated_at DESC,rowid DESC LIMIT 10").user_error(crate::error::ErrorCode::CannotReadSavedReviews)?;
        let rows = q
            .query_map([lecture], |r| r.get::<_, String>(0))
            .user_error(crate::error::ErrorCode::CannotReadSavedReviews)?;
        rows.map(|r| {
            serde_json::from_str(&r.user_error(crate::error::ErrorCode::CannotReadReviewProgress)?)
                .user_error(crate::error::ErrorCode::SavedReviewProgressIsInvalid)
        })
        .collect()
    }
    pub fn review_checkpoint(&self, lecture: &str, id: &str) -> AppResult<ReviewCheckpoint> {
        let json: String = self
            .lock()?
            .query_row(
                "SELECT payload FROM review_checkpoints WHERE lecture_id=?1 AND id=?2",
                params![lecture, id],
                |r| r.get(0),
            )
            .optional()
            .user_error(crate::error::ErrorCode::CannotReadSavedReview)?
            .ok_or(crate::error::ErrorCode::SavedReviewNotFound)?;
        serde_json::from_str(&json)
            .user_error(crate::error::ErrorCode::SavedReviewProgressIsInvalid)
    }
    pub fn save_review_checkpoint(&self, review: &ReviewCheckpoint) -> AppResult<()> {
        let json = serde_json::to_string(review)
            .user_error(crate::error::ErrorCode::CannotEncodeReviewProgress)?;
        self.lock()?.execute("INSERT INTO review_checkpoints VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",params![review.id,review.lecture_id,json,now()]).user_error(crate::error::ErrorCode::CannotSaveReviewProgressPreviouslySavedSectionsAre)?;
        Ok(())
    }
    /// One transaction makes publication idempotent across crashes and repeated Resume.
    pub fn publish_review(&self, review: &mut ReviewCheckpoint, body: &str) -> AppResult<()> {
        if body.len() > 200000 {
            return Err(
                crate::error::ErrorCode::ReviewExceedsTheSupportedSizeSavedSectionsRemain.into(),
            );
        }
        let mut db = self.lock()?;
        let tx = db
            .transaction()
            .user_error(crate::error::ErrorCode::CannotPublishReview)?;
        let current: String = tx
            .query_row(
                "SELECT payload FROM review_checkpoints WHERE id=?1",
                [&review.id],
                |r| r.get(0),
            )
            .user_error(crate::error::ErrorCode::CannotReadReviewProgress)?;
        let saved: ReviewCheckpoint = serde_json::from_str(&current)
            .user_error(crate::error::ErrorCode::InvalidReviewProgress)?;
        if saved.published_version.is_some() {
            *review = saved;
            return Ok(());
        }
        let version = new_id();
        tx.execute(
            "INSERT INTO note_versions VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![
                version,
                review.lecture_id,
                body,
                review.origin,
                review.language,
                review.source_version,
                now()
            ],
        )
        .user_error(crate::error::ErrorCode::CannotPublishReviewVersion)?;
        let mut published = review.clone();
        published.published_version = Some(version);
        published.state = "completed".into();
        published.message = "All source sections covered. Saved as a new note version.".into();
        let json = serde_json::to_string(&published)
            .user_error(crate::error::ErrorCode::CannotEncodePublishedReview)?;
        tx.execute(
            "UPDATE review_checkpoints SET payload=?2,updated_at=?3 WHERE id=?1",
            params![review.id, json, now()],
        )
        .user_error(crate::error::ErrorCode::CannotSavePublishedReview)?;
        tx.commit()
            .user_error(crate::error::ErrorCode::CannotCommitPublishedReview)?;
        *review = published;
        Ok(())
    }
}
