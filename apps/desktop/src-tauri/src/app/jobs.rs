use crate::error::{AppResult, UserFacing};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStatus {
    pub lecture_id: String,
    pub kind: String,
    pub completed: u32,
    pub total: u32,
    pub cancelling: bool,
}

#[derive(Default)]
pub struct Jobs {
    status: Mutex<Option<JobStatus>>,
    cancelled: AtomicBool,
    storage: Option<Arc<crate::database::Storage>>,
    task_id: Mutex<Option<String>>,
}

pub struct JobGuard<'a>(&'a Jobs);
impl JobGuard<'_> {
    pub fn finish<T>(self, result: &AppResult<T>) -> AppResult<()> {
        let outcome = if self.0.cancelled.load(Ordering::Relaxed) {
            "cancelled"
        } else if result.is_ok() {
            "completed"
        } else {
            "failed"
        };
        if let Some(db) = &self.0.storage {
            let mut task = self
                .0
                .task_id
                .lock()
                .user_error("Task status unavailable.")?;
            if let Some(id) = task.as_ref() {
                db.finish_task(id, outcome)?;
            }
            *task = None;
        }
        Ok(())
    }
}

impl Jobs {
    pub fn persistent(storage: Arc<crate::database::Storage>) -> Self {
        Self {
            storage: Some(storage),
            ..Self::default()
        }
    }
    pub fn status(&self) -> AppResult<Option<JobStatus>> {
        Ok(self
            .status
            .lock()
            .user_error("Task status unavailable.")?
            .clone())
    }

    pub fn begin(&self, id: &str, kind: &str) -> AppResult<JobGuard<'_>> {
        let mut status = self.status.lock().user_error("Task status unavailable.")?;
        if status.is_some() {
            return Err("Another AI task is running. Wait or cancel it.".into());
        }
        if kind != "provider-test"
            && let Some(db) = &self.storage
        {
            *self.task_id.lock().user_error("Task status unavailable.")? =
                Some(db.create_task(id, kind)?);
        }
        self.cancelled.store(false, Ordering::Relaxed);
        *status = Some(JobStatus {
            lecture_id: id.into(),
            kind: kind.into(),
            completed: 0,
            total: 0,
            cancelling: false,
        });
        Ok(JobGuard(self))
    }

    pub fn checkpoint(&self) -> AppResult<()> {
        if self.cancelled.load(Ordering::Relaxed) {
            Err("Task cancelled. Saved results are preserved.".into())
        } else {
            Ok(())
        }
    }

    pub fn progress(&self, completed: u32, total: u32) {
        if let Ok(mut status) = self.status.lock()
            && let Some(status) = status.as_mut()
        {
            status.completed = completed;
            status.total = total;
            if let Some(db) = &self.storage
                && let Ok(task) = self.task_id.lock()
                && let Some(id) = task.as_ref()
                && db.task_progress(id, completed, total).is_err()
            {
                self.cancelled.store(true, Ordering::Relaxed);
            }
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
        if let Ok(mut status) = self.status.lock()
            && let Some(status) = status.as_mut()
        {
            status.cancelling = true;
        }
    }
}

impl Drop for JobGuard<'_> {
    fn drop(&mut self) {
        if let Some(db) = &self.0.storage
            && let Ok(mut task) = self.0.task_id.lock()
            && let Some(id) = task.take()
        {
            let _ = db.finish_task(&id, "interrupted");
        }
        if let Ok(mut status) = self.0.status.lock() {
            *status = None;
        }
    }
}
