use super::Storage;
use crate::error::{AppResult, UserFacing};

impl Storage {
    pub fn existing_lecture_ids(&self, ids: &[String]) -> AppResult<Vec<String>> {
        if ids.len() > 250 {
            return Err("Too many draft identifiers.".into());
        }
        let db = self.lock()?;
        let mut query = db
            .prepare("SELECT EXISTS(SELECT 1 FROM lectures WHERE id=?1)")
            .user_error("Cannot check local drafts.")?;
        let mut existing = Vec::new();
        for id in ids {
            if id.len() > 100 {
                return Err("Invalid draft identifier.".into());
            }
            if query
                .query_row([id], |row| row.get::<_, bool>(0))
                .user_error("Cannot check local drafts.")?
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
            .user_error("Cannot check storage cleanup.")
    }
    pub fn forget_cleanup(&self, id: &str) -> AppResult<()> {
        self.lock()?
            .execute("DELETE FROM cleanup_commits WHERE id=?1", [id])
            .user_error("Cannot finish storage cleanup.")?;
        Ok(())
    }
    pub fn purge_content(&self, operation: &str, course: Option<&str>) -> AppResult<()> {
        let mut db = self.lock()?;
        let tx = db.transaction().user_error("Cannot begin deletion.")?;
        // Explicitly remove legacy child tables without cascading foreign keys.
        for table in [
            "processing_tasks",
            "note_versions",
            "study_marks",
            "note_drafts",
            "lecture_pins",
            "transcript_edits",
        ] {
            tx.execute(&format!("DELETE FROM {table} WHERE ?1 IS NULL OR lecture_id IN (SELECT id FROM lectures WHERE course_id=?1)"), [course]).user_error("Cannot delete course data. Files will be restored.")?;
        }
        tx.execute(
            "DELETE FROM course_documents WHERE ?1 IS NULL OR course_id=?1",
            [course],
        )
        .user_error("Cannot delete course documents.")?;
        tx.execute("DELETE FROM courses WHERE ?1 IS NULL OR id=?1", [course])
            .user_error("Cannot delete courses.")?;
        if course.is_none() {
            tx.execute("DELETE FROM local_models", [])
                .user_error("Cannot clear model records.")?;
        }
        tx.execute("INSERT INTO cleanup_commits VALUES(?1)", [operation])
            .user_error("Cannot commit deletion.")?;
        tx.commit()
            .user_error("Cannot commit deletion. Files will be restored.")
    }
    pub fn compact(&self) -> AppResult<()> {
        self.lock()?.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;").user_error("Content deleted, but database compaction failed. Restart the app and try freeing storage again.")
    }
}
