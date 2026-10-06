use super::AppPaths;
use crate::{database::Storage, domain::LectureStatus, error::AppResult};

impl Storage {
    pub fn recover(&self, paths: &AppPaths) -> AppResult<usize> {
        let unfinished = self.unfinished_recordings()?;
        for lecture in &unfinished {
            let path = paths.recording(&lecture.course_id, &lecture.id)?;
            let duration = hound::WavReader::open(&path)
                .map(|reader| reader.duration() as f64 / reader.spec().sample_rate as f64)
                .unwrap_or(0.0);
            self.finish_lecture(&lecture.id, duration, LectureStatus::Interrupted)?;
            self.snapshot(paths, &lecture.id)?;
            let _ = std::fs::remove_file(
                paths
                    .data
                    .join("recovery")
                    .join(format!("{}.json", lecture.id)),
            );
        }
        Ok(unfinished.len())
    }
}
