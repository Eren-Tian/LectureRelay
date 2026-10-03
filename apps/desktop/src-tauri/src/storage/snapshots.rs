use super::AppPaths;
use crate::{database::Storage, error::AppResult};

impl Storage {
    pub fn snapshot(&self, paths: &AppPaths, id: &str) -> AppResult<()> {
        let detail = self.detail(id)?;
        paths.snapshot(&detail.lecture, &detail.segments, detail.note.as_ref())
    }
}
