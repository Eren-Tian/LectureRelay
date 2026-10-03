use crate::error::{AppResult, UserFacing};
use std::{
    os::windows::io::{AsRawHandle, BorrowedHandle, OwnedHandle},
    process::Child,
    sync::{Arc, Mutex, Weak},
};
use windows::Win32::{
    Foundation::HANDLE,
    System::Threading::{
        GetCurrentProcess, GetExitCodeProcess, GetProcessAffinityMask, SetProcessAffinityMask,
    },
};

/// One shared CPU mask for all local AI, including workers already processing audio.
pub struct Performance {
    available: usize,
    state: Mutex<Policy>,
}
struct Policy {
    quiet: bool,
    workers: Vec<Weak<OwnedHandle>>,
}
impl Performance {
    pub fn threads(&self) -> usize {
        let quiet = self.state.lock().map(|p| p.quiet).unwrap_or(true);
        mask(self.available, quiet).count_ones() as usize
    }
    pub fn new(quiet: bool) -> AppResult<Self> {
        let (mut available, mut system) = (0, 0);
        unsafe { GetProcessAffinityMask(GetCurrentProcess(), &mut available, &mut system) }
            .user_error("Cannot read available CPU resources.")?;
        Ok(Self {
            available,
            state: Mutex::new(Policy {
                quiet,
                workers: Vec::new(),
            }),
        })
    }
    pub fn register(&self, child: &Child) -> AppResult<Arc<OwnedHandle>> {
        let handle = Arc::new(
            unsafe { BorrowedHandle::borrow_raw(child.as_raw_handle()) }
                .try_clone_to_owned()
                .user_error("Cannot manage local speech performance.")?,
        );
        let mut policy = self
            .state
            .lock()
            .user_error("Speech preferences are busy.")?;
        apply(&handle, mask(self.available, policy.quiet))?;
        policy.workers.retain(|worker| worker.strong_count() > 0);
        policy.workers.push(Arc::downgrade(&handle));
        Ok(handle)
    }
    pub fn save(&self, quiet: bool, persist: impl FnOnce() -> AppResult<()>) -> AppResult<()> {
        let mut policy = self
            .state
            .lock()
            .user_error("Speech preferences are busy.")?;
        let workers: Vec<_> = policy.workers.iter().filter_map(Weak::upgrade).collect();
        let result = workers
            .iter()
            .try_for_each(|worker| apply(worker, mask(self.available, quiet)))
            .and_then(|_| persist());
        if let Err(error) = result {
            // A failed save must not leave running workers on an unsaved policy.
            for worker in &workers {
                let _ = apply(worker, mask(self.available, policy.quiet));
            }
            return Err(error);
        }
        policy.quiet = quiet;
        Ok(())
    }
}
fn mask(available: usize, quiet: bool) -> usize {
    if !quiet {
        return available;
    }
    let mut selected = 0usize;
    for bit in 0..usize::BITS {
        if available & (1usize << bit) != 0 {
            selected |= 1usize << bit;
        }
        if selected.count_ones() == 4 {
            break;
        }
    }
    selected
}
fn apply(process: &OwnedHandle, affinity: usize) -> AppResult<()> {
    let handle = HANDLE(process.as_raw_handle());
    unsafe {
        let mut exit = 0;
        GetExitCodeProcess(handle, &mut exit).user_error("Cannot check local speech worker.")?;
        if exit != 259 {
            return Ok(());
        } // STILL_ACTIVE; a completed worker needs no update.
        SetProcessAffinityMask(handle, affinity)
            .user_error("Cannot change local speech performance.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quiet_budget_preserves_available_cpu_mask() {
        for available in [1, 0b1010, 0b101010101010, usize::MAX] {
            let quiet = mask(available, true);
            assert_eq!(quiet & !available, 0);
            assert_eq!(quiet.count_ones(), available.count_ones().min(4));
            assert_eq!(mask(available, false), available);
        }
    }
    #[test]
    fn failed_persistence_keeps_previous_policy() {
        let performance = Performance::new(true).unwrap();
        assert!(
            performance
                .save(false, || Err("disk write failed".into()))
                .is_err()
        );
        assert!(performance.state.lock().unwrap().quiet);
        performance.save(false, || Ok(())).unwrap();
        assert!(!performance.state.lock().unwrap().quiet);
    }
}
