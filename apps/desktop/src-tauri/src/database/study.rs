use super::Storage;
use crate::{
    domain::*,
    error::{AppResult, UserFacing},
};
use rusqlite::{OptionalExtension, params};
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingTask {
    pub id: String,
    pub lecture_id: String,
    pub kind: String,
    pub language: String,
    pub state: String,
    pub completed: u32,
    pub total: u32,
    pub message: String,
    pub updated_at: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyMark {
    pub id: String,
    pub seconds: f64,
    pub label: String,
    pub kind: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteVersion {
    pub id: String,
    pub body: String,
    pub origin: String,
    pub language: String,
    pub source_version: String,
    pub created_at: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseDocument {
    pub id: String,
    pub name: String,
    pub path: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyState {
    pub reviews: Vec<super::review::ReviewCheckpoint>,
    pub tasks: Vec<ProcessingTask>,
    pub marks: Vec<StudyMark>,
    pub versions: Vec<NoteVersion>,
    pub draft: Option<String>,
    pub source_version: String,
    pub documents: Vec<CourseDocument>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    pub lecture: Lecture,
    pub course_name: String,
    pub pinned: bool,
}

impl Storage {
    pub fn source_version(&self, id: &str) -> AppResult<String> {
        let mut digest = Sha256::new();
        for s in self.segments(id)? {
            digest.update(s.id.as_bytes());
            digest.update(s.revision.to_le_bytes());
            digest.update(s.source_text.as_bytes());
        }
        Ok(format!("{:x}", digest.finalize()))
    }
    pub fn create_task(&self, lecture: &str, kind: &str) -> AppResult<String> {
        let detail = self.lecture(lecture)?;
        let language = self.course(&detail.course_id)?.assistance_language;
        let id = new_id();
        self.lock()?.execute("INSERT INTO processing_tasks(id,lecture_id,kind,language,state,created_at,updated_at) VALUES(?1,?2,?3,?4,'running',?5,?5)",params![id,lecture,kind,language,now()]).user_error("Cannot save processing task. No request was sent.")?;
        Ok(id)
    }
    pub fn task_progress(&self, id: &str, completed: u32, total: u32) -> AppResult<()> {
        self.lock()?.execute("UPDATE processing_tasks SET completed=?2,total=?3,updated_at=?4 WHERE id=?1 AND state='running'",params![id,completed,total,now()]).user_error("Cannot save task progress.")?;
        Ok(())
    }
    pub fn finish_task(&self, id: &str, state: &str) -> AppResult<()> {
        let message = match state {
            "failed" => "Processing failed. Saved audio and completed results are preserved.",
            "cancelled" => "Cancelled. Saved results are preserved.",
            "interrupted" => "Processing was interrupted. Resume from saved results.",
            _ => "",
        };
        self.lock()?
            .execute(
                "UPDATE processing_tasks SET state=?2,message=?3,updated_at=?4 WHERE id=?1",
                params![id, state, message, now()],
            )
            .user_error("Cannot save task outcome.")?;
        Ok(())
    }
    pub fn tasks(&self, id: &str) -> AppResult<Vec<ProcessingTask>> {
        let db = self.lock()?;
        let mut q=db.prepare("SELECT id,lecture_id,kind,language,state,completed,total,message,updated_at FROM processing_tasks WHERE lecture_id=?1 ORDER BY created_at DESC,rowid DESC LIMIT 40").user_error("Cannot read processing history.")?;
        q.query_map([id], |r| {
            Ok(ProcessingTask {
                id: r.get(0)?,
                lecture_id: r.get(1)?,
                kind: r.get(2)?,
                language: r.get(3)?,
                state: r.get(4)?,
                completed: r.get(5)?,
                total: r.get(6)?,
                message: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })
        .user_error("Cannot read tasks.")?
        .collect::<rusqlite::Result<_>>()
        .user_error("Cannot read tasks.")
    }
    /// Compare the exact input revision and target language inside the write transaction.
    pub fn translate_checked(
        &self,
        s: &TranscriptSegment,
        language: &str,
        text: &str,
    ) -> AppResult<bool> {
        if text.trim().is_empty() || text.len() > 20000 || !valid_language(language) {
            return Err("Invalid translation result.".into());
        }
        Ok(self.lock()?.execute("UPDATE transcript_segments SET translated_text=?5 WHERE id=?1 AND lecture_id=?2 AND revision=?3 AND source_text=?4 AND translated_text='' AND EXISTS(SELECT 1 FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=?2 AND c.assistance_language=?6 AND c.deleted_at IS NULL)",params![s.id,s.lecture_id,s.revision,s.source_text,text,language]).user_error("Cannot save translation.")?==1)
    }
    pub fn add_note_version(
        &self,
        id: &str,
        body: &str,
        origin: &str,
        language: &str,
        source: &str,
    ) -> AppResult<String> {
        self.lecture(id)?;
        if body.len() > 200000 {
            return Err("Notes exceed the supported size.".into());
        }
        let version = new_id();
        self.lock()?
            .execute(
                "INSERT INTO note_versions VALUES(?1,?2,?3,?4,?5,?6,?7)",
                params![version, id, body, origin, language, source, now()],
            )
            .user_error("Cannot save note version.")?;
        Ok(version)
    }
    pub fn save_draft(&self, id: &str, body: &str) -> AppResult<()> {
        self.lecture(id)?;
        if body.len() > 200000 {
            return Err("Draft exceeds the supported size.".into());
        }
        self.lock()?.execute("INSERT INTO note_drafts VALUES(?1,?2,?3) ON CONFLICT(lecture_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at",params![id,body,now()]).user_error("Draft could not be saved. Keep this window open.")?;
        Ok(())
    }
    pub fn clear_draft(&self, id: &str) -> AppResult<()> {
        self.lock()?
            .execute("DELETE FROM note_drafts WHERE lecture_id=?1", [id])
            .user_error("Cannot clear draft.")?;
        Ok(())
    }
    pub fn save_mark(&self, id: &str, seconds: f64, label: &str, kind: &str) -> AppResult<()> {
        let lecture = self.lecture(id)?;
        if !seconds.is_finite()
            || seconds < 0.0
            || (lecture.status != "recording" && seconds > lecture.duration_seconds + 0.1)
            || label.trim().is_empty()
            || label.len() > 300
            || !matches!(kind, "bookmark" | "chapter")
        {
            return Err("Choose a valid timestamp and a short label.".into());
        }
        self.lock()?
            .execute(
                "INSERT INTO study_marks VALUES(?1,?2,?3,?4,?5)",
                params![new_id(), id, seconds, label.trim(), kind],
            )
            .user_error("Cannot save bookmark.")?;
        Ok(())
    }
    pub fn delete_mark(&self, lecture: &str, id: &str) -> AppResult<()> {
        self.lock()?
            .execute(
                "DELETE FROM study_marks WHERE id=?1 AND lecture_id=?2",
                params![id, lecture],
            )
            .user_error("Cannot remove bookmark.")?;
        Ok(())
    }
    pub fn documents(&self, course: &str) -> AppResult<Vec<CourseDocument>> {
        let db = self.lock()?;
        let mut q=db.prepare("SELECT id,name,path FROM course_documents WHERE course_id=?1 ORDER BY created_at,id").user_error("Cannot read course documents.")?;
        q.query_map([course], |r| {
            Ok(CourseDocument {
                id: r.get(0)?,
                name: r.get(1)?,
                path: r.get(2)?,
            })
        })
        .user_error("Cannot read documents.")?
        .collect::<rusqlite::Result<_>>()
        .user_error("Cannot read documents.")
    }
    pub fn add_document(&self, id: &str, course: &str, name: &str, path: &str) -> AppResult<()> {
        self.lock()?
            .execute(
                "INSERT INTO course_documents VALUES(?1,?2,?3,?4,?5)",
                params![id, course, name, path, now()],
            )
            .user_error("Cannot save course document.")?;
        Ok(())
    }
    pub fn study_state(&self, id: &str) -> AppResult<StudyState> {
        let lecture = self.lecture(id)?;
        let tasks = self.tasks(id)?;
        let source_version = self.source_version(id)?;
        let documents = self.documents(&lecture.course_id)?;
        let reviews = self.reviews(id)?;
        let db = self.lock()?;
        let mut q=db.prepare("SELECT id,seconds,label,kind FROM study_marks WHERE lecture_id=?1 ORDER BY seconds,id").user_error("Cannot read bookmarks.")?;
        let marks = q
            .query_map([id], |r| {
                Ok(StudyMark {
                    id: r.get(0)?,
                    seconds: r.get(1)?,
                    label: r.get(2)?,
                    kind: r.get(3)?,
                })
            })
            .user_error("Cannot read bookmarks.")?
            .collect::<rusqlite::Result<_>>()
            .user_error("Cannot read bookmarks.")?;
        let mut q=db.prepare("SELECT id,body,origin,language,source_version,created_at FROM note_versions WHERE lecture_id=?1 ORDER BY created_at DESC,rowid DESC LIMIT 30").user_error("Cannot read note history.")?;
        let versions = q
            .query_map([id], |r| {
                Ok(NoteVersion {
                    id: r.get(0)?,
                    body: r.get(1)?,
                    origin: r.get(2)?,
                    language: r.get(3)?,
                    source_version: r.get(4)?,
                    created_at: r.get(5)?,
                })
            })
            .user_error("Cannot read note history.")?
            .collect::<rusqlite::Result<_>>()
            .user_error("Cannot read note history.")?;
        let draft = db
            .query_row(
                "SELECT body FROM note_drafts WHERE lecture_id=?1",
                [id],
                |r| r.get(0),
            )
            .optional()
            .user_error("Cannot read draft.")?;
        Ok(StudyState {
            reviews,
            tasks,
            marks,
            versions,
            draft,
            source_version,
            documents,
        })
    }
    pub fn pin_lecture(&self, id: &str, pinned: bool) -> AppResult<()> {
        self.lecture(id)?;
        let sql = if pinned {
            "INSERT OR IGNORE INTO lecture_pins VALUES(?1)"
        } else {
            "DELETE FROM lecture_pins WHERE lecture_id=?1"
        };
        self.lock()?
            .execute(sql, [id])
            .user_error("Cannot save pin.")?;
        Ok(())
    }
    pub fn library(&self, query: &str) -> AppResult<Vec<LibraryEntry>> {
        let pattern = format!("%{}%", query.trim().chars().take(200).collect::<String>());
        let db = self.lock()?;
        let mut q=db.prepare("SELECT l.id,l.course_id,l.title,l.started_at,l.ended_at,l.duration_seconds,l.status,l.recording_path,l.transcribed_until,l.audio_source,c.name,p.lecture_id IS NOT NULL FROM lectures l JOIN courses c ON c.id=l.course_id LEFT JOIN lecture_pins p ON p.lecture_id=l.id WHERE c.deleted_at IS NULL AND (l.title LIKE ?1 OR c.name LIKE ?1 OR EXISTS(SELECT 1 FROM transcript_segments s WHERE s.lecture_id=l.id AND (s.source_text LIKE ?1 OR s.translated_text LIKE ?1))) ORDER BY p.lecture_id IS NOT NULL DESC,l.started_at DESC LIMIT 200").user_error("Cannot search library.")?;
        q.query_map([pattern], |r| {
            Ok(LibraryEntry {
                lecture: super::rows::lecture_from_row(r)?,
                course_name: r.get(10)?,
                pinned: r.get(11)?,
            })
        })
        .user_error("Cannot search library.")?
        .collect::<rusqlite::Result<_>>()
        .user_error("Cannot search library.")
    }
}
