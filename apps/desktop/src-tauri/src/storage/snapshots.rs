use super::AppPaths;
use crate::{
    database::Storage,
    error::{AppResult, UserFacing},
};

impl Storage {
    pub fn snapshot(&self, paths: &AppPaths, id: &str) -> AppResult<()> {
        // Read after obtaining the writer lock: an older snapshot must not
        // finish after a newer one and replace current sidecars.
        let _snapshot = self
            .snapshots
            .lock()
            .user_error("Cannot save lecture snapshot.")?;
        let detail = self.detail(id)?;
        paths.snapshot(&detail.lecture, &detail.segments, detail.note.as_ref())
    }
}
