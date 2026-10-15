use super::Storage;
use crate::error::{AppResult, UserFacing};

impl Storage {
    pub fn existing_lecture_ids(&self, ids: &[String]) -> AppResult<Vec<String>> {
        if ids.len() > 250 {
            return Err(crate::error::ErrorCode::TooManyDraftIdentifiers.into());
        }
        let db = self.lock()?;
        let mut query = db
            .prepare("SELECT EXISTS(SELECT 1 FROM lectures WHERE id=?1)")
            .user_error(crate::error::ErrorCode::CannotCheckLocalDrafts)?;
        let mut existing = Vec::new();
        for id in ids {
            if id.len() > 100 {
                return Err(crate::error::ErrorCode::InvalidDraftIdentifier.into());
            }
            if query
                .query_row([id], |row| row.get::<_, bool>(0))
                .user_error(crate::error::ErrorCode::CannotCheckLocalDrafts)?
            {
                existing.push(id.clone());
            }
        }
        Ok(existing)
    }
    pub fn cleanup_committed(&self, id: &str) -> AppResult<bool> {
        self.lock()?
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM cleanup_commits WHERE id=?1)",
                [id],
                |r| r.get(0),
            )
            .user_error(crate::error::ErrorCode::CannotCheckStorageCleanup)
    }
    pub fn forget_cleanup(&self, id: &str) -> AppResult<()> {
        self.lock()?
            .execute("DELETE FROM cleanup_commits WHERE id=?1", [id])
            .user_error(crate::error::ErrorCode::CannotFinishStorageCleanup)?;
        Ok(())
    }
    pub fn purge_content(&self, operation: &str, course: Option<&str>) -> AppResult<()> {
        let mut db = self.lock()?;
        let tx = db
            .transaction()
            .user_error(crate::error::ErrorCode::CannotBeginDeletion)?;
        // Explicitly remove legacy child tables without cascading foreign keys.
        for table in [
            "processing_tasks",
            "note_versions",
            "study_marks",
            "note_drafts",
            "lecture_pins",
            "transcript_edits",
        ] {
            tx.execute(&format!("DELETE FROM {table} WHERE ?1 IS NULL OR lecture_id IN (SELECT id FROM lectures WHERE course_id=?1)"), [course]).user_error(crate::error::ErrorCode::CannotDeleteCourseDataFilesWillBeRestored)?;
        }
        tx.execute(
            "DELETE FROM course_documents WHERE ?1 IS NULL OR course_id=?1",
            [course],
        )
        .user_error(crate::error::ErrorCode::CannotDeleteCourseDocuments)?;
        tx.execute("DELETE FROM courses WHERE ?1 IS NULL OR id=?1", [course])
            .user_error(crate::error::ErrorCode::CannotDeleteCourses)?;
        if course.is_none() {
            tx.execute("DELETE FROM local_models", [])
                .user_error(crate::error::ErrorCode::CannotClearModelRecords)?;
        }
        tx.execute("INSERT INTO cleanup_commits VALUES(?1)", [operation])
            .user_error(crate::error::ErrorCode::CannotCommitDeletion)?;
        tx.commit()
            .user_error(crate::error::ErrorCode::CannotCommitDeletionFilesWillBeRestored)
    }
    pub fn compact(&self) -> AppResult<()> {
        self.lock()?
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")
            .user_error(
                crate::error::ErrorCode::ContentDeletedButDatabaseCompactionFailedRestartThe,
            )
    }

    pub fn purge_lecture_content(&self, operation: &str, id: &str) -> AppResult<()> {
        let mut db = self.lock()?;
        let tx = db
            .transaction()
            .user_error(crate::error::ErrorCode::CannotBeginLectureDeletion)?;
        for table in [
            "processing_tasks",
            "note_versions",
            "study_marks",
            "note_drafts",
            "lecture_pins",
            "transcript_edits",
        ] {
            tx.execute(&format!("DELETE FROM {table} WHERE lecture_id=?1"), [id])
                .user_error(crate::error::ErrorCode::CannotDeleteLectureDataFilesWillBeRestored)?;
        }
        let count = tx
            .execute("DELETE FROM lectures WHERE id=?1", [id])
            .user_error(crate::error::ErrorCode::CannotDeleteLecture)?;
        if count != 1 {
            return Err(crate::error::ErrorCode::LectureNotFoundFilesWillBeRestored.into());
        }
        tx.execute("INSERT INTO cleanup_commits VALUES(?1)", [operation])
            .user_error(crate::error::ErrorCode::CannotCommitLectureDeletion)?;
        tx.commit()
            .user_error(crate::error::ErrorCode::CannotCommitLectureDeletionFilesWillBeRestored)
    }
}
