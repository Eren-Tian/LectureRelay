use crate::domain::Lecture;

pub(super) fn lecture_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Lecture> {
    Ok(Lecture {
        id: r.get(0)?,
        course_id: r.get(1)?,
        title: r.get(2)?,
        started_at: r.get(3)?,
        ended_at: r.get(4)?,
        duration_seconds: r.get(5)?,
        status: r.get(6)?,
        recording_path: r.get(7)?,
        transcribed_until: r.get(8)?,
        audio_source: r.get(9)?,
    })
}
