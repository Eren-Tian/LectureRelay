use serde::Serialize;
use std::time::Instant;

// Opt-in short acceptance traces. No audio, transcript, prompt or credentials are logged.
// Normal sessions (including the independent memory soak) do not create these files.
pub fn caption_stage(
    paths: &crate::storage::AppPaths,
    lecture: &str,
    stage: &str,
    segments: &[crate::domain::TranscriptSegment],
    audio_end: f64,
) {
    if std::env::var("LECTURERELAY_TRACE_CAPTIONS").as_deref() != Ok("1") {
        return;
    }
    use std::io::Write;
    let Ok(now) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) else {
        return;
    };
    let value = serde_json::json!({
        "utcMs": now.as_secs_f64() * 1000.0,
        "stage": stage, "audioEndSeconds": audio_end,
        "segments": segments.iter().map(|s| serde_json::json!({
            "id": s.id, "start": s.start_seconds, "end": s.end_seconds
        })).collect::<Vec<_>>()
    });
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(
        paths
            .data
            .join("logs")
            .join(format!("{lecture}-caption-stages.jsonl")),
    ) {
        let _ = writeln!(file, "{value}");
    }
}
use windows::Win32::{
    Foundation::{CloseHandle, FILETIME},
    System::{
        ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS},
        Threading::{
            GetCurrentProcess, GetProcessTimes, OpenProcess, PROCESS_QUERY_INFORMATION,
            PROCESS_VM_READ,
        },
    },
};
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Measurements {
    pub samples: u64,
    pub cpu_average_percent: f64,
    pub cpu_peak_percent: f64,
    pub ram_peak_mib: f64,
    pub ram_mib: f64,
    pub stt_average_ms: f64,
    pub stt_peak_ms: f64,
    pub translation_average_ms: f64,
    pub translation_peak_ms: f64,
    pub dropped_chunks: u32,
    pub speech_backlog_seconds: f64,
    pub translation_queue: usize,
}
pub struct Monitor {
    pub data: Measurements,
    last: Instant,
    last_cpu: u64,
    cpu_sum: f64,
    stt_count: u64,
    stt_sum: f64,
    translation_count: u64,
    translation_sum: f64,
}
fn process(pid: Option<u32>) -> Option<(u64, usize)> {
    unsafe {
        let handle = if let Some(pid) = pid {
            OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid).ok()?
        } else {
            GetCurrentProcess()
        };
        let mut creation = FILETIME::default();
        let mut exit = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        let mut memory = PROCESS_MEMORY_COUNTERS {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            ..Default::default()
        };
        let ok = GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user).is_ok()
            && GetProcessMemoryInfo(handle, &mut memory, memory.cb).is_ok();
        if pid.is_some() {
            let _ = CloseHandle(handle);
        }
        let ticks = |t: FILETIME| (u64::from(t.dwHighDateTime) << 32) | u64::from(t.dwLowDateTime);
        ok.then_some((ticks(kernel) + ticks(user), memory.WorkingSetSize))
    }
}
impl Monitor {
    pub fn new(pid: Option<u32>) -> Self {
        let cpu = process(None).unwrap_or_default().0
            + pid.and_then(|p| process(Some(p))).unwrap_or_default().0;
        Self {
            data: Default::default(),
            last: Instant::now(),
            last_cpu: cpu,
            cpu_sum: 0.0,
            stt_count: 0,
            stt_sum: 0.0,
            translation_count: 0,
            translation_sum: 0.0,
        }
    }
    pub fn sample(&mut self, pid: Option<u32>) {
        let parent = process(None).unwrap_or_default();
        let child = pid.and_then(|p| process(Some(p))).unwrap_or_default();
        let cpu = parent.0 + child.0;
        let cores = std::thread::available_parallelism()
            .map(|v| v.get())
            .unwrap_or(1) as f64;
        let percent = ((cpu.saturating_sub(self.last_cpu) as f64 / 10_000_000.0)
            / self.last.elapsed().as_secs_f64()
            / cores
            * 100.0)
            .clamp(0.0, 100.0);
        self.last_cpu = cpu;
        self.last = Instant::now();
        self.data.samples += 1;
        self.cpu_sum += percent;
        self.data.cpu_average_percent = self.cpu_sum / self.data.samples as f64;
        self.data.cpu_peak_percent = self.data.cpu_peak_percent.max(percent);
        self.data.ram_mib = (parent.1 + child.1) as f64 / 1048576.0;
        self.data.ram_peak_mib = self.data.ram_peak_mib.max(self.data.ram_mib);
    }
    pub fn stt(&mut self, ms: f64) {
        self.stt_count += 1;
        self.stt_sum += ms;
        self.data.stt_average_ms = self.stt_sum / self.stt_count as f64;
        self.data.stt_peak_ms = self.data.stt_peak_ms.max(ms);
    }
    pub fn translation(&mut self, ms: f64) {
        self.translation_count += 1;
        self.translation_sum += ms;
        self.data.translation_average_ms = self.translation_sum / self.translation_count as f64;
        self.data.translation_peak_ms = self.data.translation_peak_ms.max(ms);
    }
}
