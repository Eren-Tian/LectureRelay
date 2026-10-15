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
        let mut query = db.prepare("SELECT id,course_id,title,started_at,ended_at,duration_seconds,status,recording_path,transcribed_until,audio_source FROM lectures WHERE status='recording'").user_error(crate::error::ErrorCode::CannotReadRecoveryRecord)?;
        query
            .query_map([], lecture_from_row)
            .user_error(crate::error::ErrorCode::CannotReadRecoveryRecord)?
            .collect::<rusqlite::Result<_>>()
            .user_error(crate::error::ErrorCode::TheRecoveryRecordIsDamaged)
    }

    pub fn set_audio_source(&self, id: &str, source: LectureSource) -> AppResult<()> {
        self.lock()?
            .execute(
                "UPDATE lectures SET audio_source=?2 WHERE id=?1",
                params![id, source],
            )
            .user_error(crate::error::ErrorCode::CannotSaveAudioSource)?;
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
            return Err(crate::error::ErrorCode::EnterAValidLectureTitle.into());
        }
        let id = new_id();
        let dir = paths.lecture_dir(course_id, &id)?;
        std::fs::create_dir_all(&dir)
            .user_error(crate::error::ErrorCode::CannotCreateTheRecordingFolderCheckPermissions)?;
        self.lock()?.execute("INSERT INTO lectures(id,course_id,title,started_at,status,recording_path) VALUES(?1,?2,?3,?4,'recording',?5)",params![id,course_id,title,now(),paths.recording(course_id,&id)?.to_string_lossy()]).user_error(crate::error::ErrorCode::CannotSaveLecture)?;
        self.lecture(&id)
    }

    pub fn lectures(&self, course_id: &str) -> AppResult<Vec<Lecture>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT id,course_id,title,started_at,ended_at,duration_seconds,status,recording_path,transcribed_until,audio_source FROM lectures WHERE course_id=?1 ORDER BY started_at DESC").user_error(crate::error::ErrorCode::CannotReadLecture)?;
        query
            .query_map([course_id], lecture_from_row)
            .user_error(crate::error::ErrorCode::CannotReadLecture)?
            .collect::<rusqlite::Result<_>>()
            .user_error(crate::error::ErrorCode::CannotReadLectureData)
    }

    pub fn lecture(&self, id: &str) -> AppResult<Lecture> {
        self.lock()?.query_row("SELECT id,course_id,title,started_at,ended_at,duration_seconds,status,recording_path,transcribed_until,audio_source FROM lectures WHERE id=?1", [id], lecture_from_row).optional().user_error(crate::error::ErrorCode::CannotReadLecture)?.ok_or_else(|| crate::error::ErrorCode::TheLectureDoesNotExist.into())
    }

    pub fn finish_lecture(&self, id: &str, duration: f64, status: LectureStatus) -> AppResult<()> {
        self.lock()?
            .execute(
                "UPDATE lectures SET duration_seconds=?2,status=?3,ended_at=?4 WHERE id=?1",
                params![id, duration, status, now()],
            )
            .user_error(crate::error::ErrorCode::CannotSaveLectureStatus)?;
        Ok(())
    }
}
