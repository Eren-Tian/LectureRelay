use super::Storage;
use super::rows::lecture_from_row;
use crate::{
    domain::*,
    error::{AppResult, UserFacing},
    storage::AppPaths,
};
use rusqlite::{OptionalExtension, params};

impl Storage {
    pub(crate) fn unfinished_recordings(&self) -> AppResult<Vec<Lecture>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT id,course_id,title,started_at,ended_at,duration_seconds,status,recording_path,transcribed_until,audio_source FROM lectures WHERE status='recording'").user_error("Cannot read recovery record.")?;
        query
            .query_map([], lecture_from_row)
            .user_error("Cannot read recovery record.")?
            .collect::<rusqlite::Result<_>>()
            .user_error("The recovery record is damaged.")
    }

    pub fn set_audio_source(&self, id: &str, source: &str) -> AppResult<()> {
        self.lock()?
            .execute(
                "UPDATE lectures SET audio_source=?2 WHERE id=?1",
                params![id, source],
            )
            .user_error("Cannot save audio source.")?;
        Ok(())
    }

    pub fn create_lecture(
        &self,
        paths: &AppPaths,
        course_id: &str,
        title: &str,
    ) -> AppResult<Lecture> {
        self.course(course_id)?;
        let title = title.trim();
        if title.is_empty() || title.len() > 300 {
            return Err("Enter a valid lecture title.".into());
        }
        let id = new_id();
        let dir = paths.lecture_dir(course_id, &id)?;
        std::fs::create_dir_all(&dir)
            .user_error("Cannot create the recording folder. Check permissions.")?;
        self.lock()?.execute("INSERT INTO lectures(id,course_id,title,started_at,status,recording_path) VALUES(?1,?2,?3,?4,'recording',?5)",params![id,course_id,title,now(),paths.recording(course_id,&id)?.to_string_lossy()]).user_error("Cannot save lecture.")?;
        self.lecture(&id)
    }

    pub fn lectures(&self, course_id: &str) -> AppResult<Vec<Lecture>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT id,course_id,title,started_at,ended_at,duration_seconds,status,recording_path,transcribed_until,audio_source FROM lectures WHERE course_id=?1 ORDER BY started_at DESC").user_error("Cannot read lecture.")?;
        query
            .query_map([course_id], lecture_from_row)
            .user_error("Cannot read lecture.")?
            .collect::<rusqlite::Result<_>>()
            .user_error("Cannot read lecture data.")
    }

    pub fn lecture(&self, id: &str) -> AppResult<Lecture> {
        self.lock()?.query_row("SELECT id,course_id,title,started_at,ended_at,duration_seconds,status,recording_path,transcribed_until,audio_source FROM lectures WHERE id=?1", [id], lecture_from_row).optional().user_error("Cannot read lecture.")?.ok_or("The lecture does not exist.".into())
    }

    pub fn finish_lecture(&self, id: &str, duration: f64, status: &str) -> AppResult<()> {
        self.lock()?
            .execute(
                "UPDATE lectures SET duration_seconds=?2,status=?3,ended_at=?4 WHERE id=?1",
                params![id, duration, status, now()],
            )
            .user_error("Cannot save lecture status.")?;
        Ok(())
    }
}
