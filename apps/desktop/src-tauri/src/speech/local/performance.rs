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
    quiet_mask: usize,
    state: Mutex<Policy>,
}
struct Policy {
    quiet: bool,
    workers: Vec<Weak<OwnedHandle>>,
}
impl Performance {
    pub fn threads(&self) -> usize {
        let quiet = self.state.lock().map(|p| p.quiet).unwrap_or(true);
        self.affinity(quiet).count_ones() as usize
    }
    pub fn new(quiet: bool) -> AppResult<Self> {
        let (mut available, mut system) = (0, 0);
        unsafe { GetProcessAffinityMask(GetCurrentProcess(), &mut available, &mut system) }
            .user_error("Cannot read available CPU resources.")?;
        Ok(Self {
            available,
            quiet_mask: core_budget(available, &physical_cores()),
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
        apply(&handle, self.affinity(policy.quiet))?;
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
            .try_for_each(|worker| apply(worker, self.affinity(quiet)))
            .and_then(|_| persist());
        if let Err(error) = result {
            // A failed save must not leave running workers on an unsaved policy.
            for worker in &workers {
                let _ = apply(worker, self.affinity(policy.quiet));
            }
            return Err(error);
        }
        policy.quiet = quiet;
        Ok(())
    }
    fn affinity(&self, quiet: bool) -> usize {
        if quiet {
            self.quiet_mask
        } else {
            self.available
        }
    }
}
fn physical_cores() -> Vec<usize> {
    use windows::Win32::System::SystemInformation::{
        GetLogicalProcessorInformation, RelationProcessorCore, SYSTEM_LOGICAL_PROCESSOR_INFORMATION,
    };
    let mut bytes = 0;
    unsafe {
        let _ = GetLogicalProcessorInformation(None, &mut bytes);
        let count = bytes as usize / std::mem::size_of::<SYSTEM_LOGICAL_PROCESSOR_INFORMATION>();
        if count == 0 {
            return Vec::new();
        }
        let mut entries = vec![SYSTEM_LOGICAL_PROCESSOR_INFORMATION::default(); count];
        if GetLogicalProcessorInformation(Some(entries.as_mut_ptr()), &mut bytes).is_err() {
            return Vec::new();
        }
        entries
            .into_iter()
            .filter(|p| p.Relationship == RelationProcessorCore)
            .map(|p| p.ProcessorMask)
            .collect()
    }
}
fn core_budget(available: usize, cores: &[usize]) -> usize {
    if cores.is_empty() {
        return mask(available, true);
    }
    // Four adjacent logical CPUs can be only two physical cores on an SMT CPU.
    // Keep the same four-logical-CPU ceiling, choosing separate cores first.
    let mut selected = 0usize;
    for core in cores {
        let choices = core & available;
        if choices != 0 {
            selected |= 1usize << choices.trailing_zeros();
        }
        if selected.count_ones() == 4 {
            return selected;
        }
    }
    for bit in 0..usize::BITS {
        if selected.count_ones() >= 4 {
            break;
        }
        if available & (1usize << bit) != 0 {
            selected |= 1usize << bit;
        }
    }
    selected
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
    fn quiet_budget_uses_separate_physical_cores_before_smt_siblings() {
        let cores = [0b11, 0b1100, 0b110000, 0b11000000];
        assert_eq!(core_budget(0xff, &cores), 0b01010101);
        assert_eq!(core_budget(0xaa, &cores), 0xaa);
        assert_eq!(core_budget(0b1111, &cores), 0b1111);
        assert_eq!(core_budget(0b1111, &[]), 0b1111);
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
