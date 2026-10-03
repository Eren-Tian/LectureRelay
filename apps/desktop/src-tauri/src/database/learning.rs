use super::Storage;
use crate::{
    domain::*,
    error::{AppResult, UserFacing},
};
use rusqlite::{OptionalExtension, params};

impl Storage {
    pub fn latest_segments(&self, id: &str) -> AppResult<Vec<TranscriptSegment>> {
        let db = self.lock()?;
        let mut q=db.prepare("SELECT id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin,provider,status,transcript_version,revision FROM (SELECT * FROM transcript_segments WHERE lecture_id=?1 ORDER BY start_seconds DESC,id DESC LIMIT 200) ORDER BY start_seconds,id").user_error("Cannot read live captions.")?;
        q.query_map([id], |r| {
            Ok(TranscriptSegment {
                id: r.get(0)?,
                lecture_id: r.get(1)?,
                start_seconds: r.get(2)?,
                end_seconds: r.get(3)?,
                source_text: r.get(4)?,
                translated_text: r.get(5)?,
                origin: r.get(6)?,
                provider: r.get(7)?,
                status: r.get(8)?,
                transcript_version: r.get(9)?,
                revision: r.get(10)?,
            })
        })
        .user_error("Cannot read live captions.")?
        .collect::<rusqlite::Result<_>>()
        .user_error("Cannot read live captions.")
    }
    pub fn segments(&self, lecture_id: &str) -> AppResult<Vec<TranscriptSegment>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin,provider,status,transcript_version,revision FROM transcript_segments WHERE lecture_id=?1 ORDER BY start_seconds,id").user_error("Cannot read transcript.")?;
        query
            .query_map([lecture_id], |r| {
                Ok(TranscriptSegment {
                    id: r.get(0)?,
                    lecture_id: r.get(1)?,
                    start_seconds: r.get(2)?,
                    end_seconds: r.get(3)?,
                    source_text: r.get(4)?,
                    translated_text: r.get(5)?,
                    origin: r.get(6)?,
                    provider: r.get(7)?,
                    status: r.get(8)?,
                    transcript_version: r.get(9)?,
                    revision: r.get(10)?,
                })
            })
            .user_error("Cannot read transcript.")?
            .collect::<rusqlite::Result<_>>()
            .user_error("Transcript data is damaged.")
    }

    pub fn save_segment(
        &self,
        lecture_id: &str,
        id: Option<String>,
        input: SegmentInput,
    ) -> AppResult<()> {
        let lecture = self.lecture(lecture_id)?;
        if !input.start_seconds.is_finite()
            || !input.end_seconds.is_finite()
            || input.start_seconds < 0.0
            || input.end_seconds < input.start_seconds
            || input.end_seconds > lecture.duration_seconds + 1.0
            || input.source_text.trim().is_empty()
            || input.source_text.len() > 10000
            || input.translated_text.len() > 20000
        {
            return Err("Check transcript content and timestamps.".into());
        }
        if let Some(ref id) = id
            && !self.segments(lecture_id)?.iter().any(|s| &s.id == id)
        {
            return Err("Transcript segment does not exist.".into());
        }
        self.lock()?.execute("INSERT INTO transcript_segments(id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin) VALUES(?1,?2,?3,?4,?5,?6,'manual') ON CONFLICT(id) DO UPDATE SET revision=transcript_segments.revision+CASE WHEN transcript_segments.source_text!=excluded.source_text OR transcript_segments.start_seconds!=excluded.start_seconds OR transcript_segments.end_seconds!=excluded.end_seconds THEN 1 ELSE 0 END,start_seconds=excluded.start_seconds,end_seconds=excluded.end_seconds,source_text=excluded.source_text,translated_text=excluded.translated_text,origin='manual'",params![id.unwrap_or_else(new_id),lecture_id,input.start_seconds,input.end_seconds,input.source_text.trim(),input.translated_text.trim()]).user_error("Cannot save transcript.")?;
        Ok(())
    }

    pub fn append_cloud_chunk(
        &self,
        lecture_id: &str,
        segments: &[TranscriptSegment],
        until: f64,
    ) -> AppResult<()> {
        let mut db = self.lock()?;
        let tx = db
            .transaction()
            .user_error("Cannot save transcript segments.")?;
        for s in segments {
            tx.execute("INSERT OR IGNORE INTO transcript_segments(id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin,provider,status,transcript_version) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",params![s.id,lecture_id,s.start_seconds,s.end_seconds,s.source_text,s.translated_text,s.origin,s.provider,s.status,s.transcript_version]).user_error("Cannot save transcript segments.")?;
        }
        tx.execute(
            "UPDATE lectures SET transcribed_until=MAX(transcribed_until,?2) WHERE id=?1",
            params![lecture_id, until],
        )
        .user_error("Cannot save transcription progress.")?;
        tx.commit().user_error("Cannot commit transcript segments.")
    }

    #[cfg(test)]
    pub fn translate_segment(&self, lecture_id: &str, id: &str, text: &str) -> AppResult<()> {
        self.lock()?.execute("UPDATE transcript_segments SET translated_text=?3 WHERE id=?1 AND lecture_id=?2 AND translated_text=''",params![id,lecture_id,text]).user_error("Cannot save translation.")?;
        Ok(())
    }

    pub fn note(&self, lecture_id: &str) -> AppResult<Option<Note>> {
        self.lock()?
            .query_row(
                "SELECT body,updated_at,origin FROM notes WHERE lecture_id=?1",
                [lecture_id],
                |r| {
                    Ok(Note {
                        body: r.get(0)?,
                        updated_at: r.get(1)?,
                        origin: r.get(2)?,
                    })
                },
            )
            .optional()
            .user_error("Cannot read notes.")
    }

    pub fn save_note(&self, lecture_id: &str, body: &str, origin: &str) -> AppResult<()> {
        self.lecture(lecture_id)?;
        if body.len() > 200000 {
            return Err("Notes are too long. Shorten them before saving.".into());
        }
        self.lock()?.execute("INSERT INTO notes(lecture_id,body,updated_at,origin) VALUES(?1,?2,?3,?4) ON CONFLICT(lecture_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at,origin=excluded.origin",params![lecture_id,body,now(),origin]).user_error("Cannot save notes.")?;
        Ok(())
    }

    pub fn answers(&self, lecture_id: &str) -> AppResult<Vec<Answer>> {
        let db = self.lock()?;
        let mut query = db.prepare("SELECT id,question,answer,sources_json,created_at FROM answers WHERE lecture_id=?1 ORDER BY created_at,id").user_error("Cannot read answers.")?;
        let values: Vec<(String, String, String, String, i64)> = query
            .query_map([lecture_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .user_error("Cannot read answers.")?
            .collect::<rusqlite::Result<_>>()
            .user_error("Cannot read answers.")?;
        values
            .into_iter()
            .map(|(id, question, answer, sources, created_at)| {
                Ok(Answer {
                    id,
                    question,
                    answer,
                    sources: serde_json::from_str(&sources)
                        .user_error("The answer sources is damaged.")?,
                    created_at,
                })
            })
            .collect()
    }

    pub fn save_answer(&self, lecture_id: &str, answer: &Answer) -> AppResult<()> {
        let sources =
            serde_json::to_string(&answer.sources).user_error("Cannot encode answer sources.")?;
        self.lock()?.execute("INSERT INTO answers(id,lecture_id,question,answer,sources_json,created_at) VALUES(?1,?2,?3,?4,?5,?6)",params![answer.id,lecture_id,answer.question,answer.answer,sources,answer.created_at]).user_error("Cannot save answers.")?;
        Ok(())
    }

    pub fn detail(&self, id: &str) -> AppResult<LectureDetail> {
        let lecture = self.lecture(id)?;
        Ok(LectureDetail {
            course: self.course(&lecture.course_id)?,
            segments: self.segments(id)?,
            note: self.note(id)?,
            answers: self.answers(id)?,
            lecture,
        })
    }
}
