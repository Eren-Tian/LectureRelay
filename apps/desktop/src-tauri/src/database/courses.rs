use super::Storage;
use crate::{
    domain::*,
    error::{AppResult, UserFacing},
};
use rusqlite::params;

impl Storage {
    pub fn courses(&self) -> AppResult<Vec<Course>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT c.id,c.name,c.code,c.subject,c.description,c.assistance_language,c.created_at,(SELECT COUNT(*) FROM lectures l WHERE l.course_id=c.id) FROM courses c WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC").user_error(crate::error::ErrorCode::CannotReadCourse)?;
        query
            .query_map([], course_from_row)
            .user_error(crate::error::ErrorCode::CannotReadCourse)?
            .collect::<rusqlite::Result<_>>()
            .user_error(crate::error::ErrorCode::CannotReadCourseData)
    }

    pub fn course(&self, id: &str) -> AppResult<Course> {
        self.courses()?
            .into_iter()
            .find(|course| course.id == id)
            .ok_or(crate::error::ErrorCode::TheCourseDoesNotExist.into())
    }

    pub fn save_course(&self, id: Option<String>, input: CourseInput) -> AppResult<Course> {
        if input.name.trim().is_empty()
            || input.name.len() > 300
            || input.code.len() > 80
            || input.description.len() > 10000
            || input.subject.trim().is_empty()
            || input.subject.len() > 120
            || !valid_language(&input.assistance_language)
        {
            return Err(crate::error::ErrorCode::EnterAValidCourseNameSubjectAndAssistance.into());
        }
        let id = match id {
            Some(id) => {
                self.course(&id)?;
                id
            }
            None => new_id(),
        };
        self.lock()?.execute("INSERT INTO courses(id,name,code,subject,description,assistance_language,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code,subject=excluded.subject,description=excluded.description,assistance_language=excluded.assistance_language", params![id,input.name.trim(),input.code.trim(),input.subject,input.description,input.assistance_language,now()]).user_error(crate::error::ErrorCode::CannotSaveCourse)?;
        self.course(&id)
    }

    pub fn delete_course(&self, id: &str) -> AppResult<()> {
        self.lock()?
            .execute(
                "UPDATE courses SET deleted_at=unixepoch() WHERE id=?1",
                [id],
            )
            .user_error(crate::error::ErrorCode::CannotDeleteCourse)?;
        Ok(())
    }

    pub fn trash(&self) -> AppResult<Vec<Course>> {
        let db = self.lock()?;
        let mut q = db.prepare("SELECT c.id,c.name,c.code,c.subject,c.description,c.assistance_language,c.created_at,(SELECT COUNT(*) FROM lectures l WHERE l.course_id=c.id) FROM courses c WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").user_error(crate::error::ErrorCode::CannotReadTrash)?;
        q.query_map([], course_from_row)
            .user_error(crate::error::ErrorCode::CannotReadTrash)?
            .collect::<rusqlite::Result<_>>()
            .user_error(crate::error::ErrorCode::CannotReadTrash)
    }
    pub fn restore_course(&self, id: &str) -> AppResult<()> {
        self.lock()?
            .execute("UPDATE courses SET deleted_at=NULL WHERE id=?1", [id])
            .user_error(crate::error::ErrorCode::CannotRestoreCourse)?;
        Ok(())
    }
    pub fn glossary(&self, course_id: &str) -> AppResult<Vec<GlossaryTerm>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT id,course_id,source,translation FROM glossary_terms WHERE course_id=?1 ORDER BY source COLLATE NOCASE").user_error(crate::error::ErrorCode::CannotReadGlossary)?;
        query
            .query_map([course_id], |r| {
                Ok(GlossaryTerm {
                    id: r.get(0)?,
                    course_id: r.get(1)?,
                    source: r.get(2)?,
                    translation: r.get(3)?,
                })
            })
            .user_error(crate::error::ErrorCode::CannotReadGlossary)?
            .collect::<rusqlite::Result<_>>()
            .user_error(crate::error::ErrorCode::CannotReadGlossary)
    }

    pub fn save_term(
        &self,
        course_id: &str,
        id: Option<String>,
        source: &str,
        translation: &str,
    ) -> AppResult<()> {
        self.course(course_id)?;
        if source.trim().is_empty() || source.len() > 200 || translation.len() > 400 {
            return Err(crate::error::ErrorCode::TheGlossaryTermIsEmptyOrTooLong.into());
        }
        if let Some(ref id) = id
            && !self.glossary(course_id)?.iter().any(|term| &term.id == id)
        {
            return Err(crate::error::ErrorCode::TheGlossaryDoesNotExist.into());
        }
        self.lock()?.execute("INSERT INTO glossary_terms(id,course_id,source,translation) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET source=excluded.source,translation=excluded.translation", params![id.unwrap_or_else(new_id),course_id,source.trim(),translation.trim()]).user_error(crate::error::ErrorCode::CannotSaveThisEnglishTermMayAlreadyExist)?;
        Ok(())
    }

    pub fn delete_term(&self, course_id: &str, id: &str) -> AppResult<()> {
        self.lock()?
            .execute(
                "DELETE FROM glossary_terms WHERE id=?1 AND course_id=?2",
                params![id, course_id],
            )
            .user_error(crate::error::ErrorCode::CannotDeleteGlossary)?;
        Ok(())
    }
}

fn course_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Course> {
    Ok(Course {
        id: r.get(0)?,
        name: r.get(1)?,
        code: r.get(2)?,
        subject: r.get(3)?,
        description: r.get(4)?,
        assistance_language: r.get(5)?,
        created_at: r.get(6)?,
        lecture_count: r.get(7)?,
    })
}
