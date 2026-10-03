use crate::error::{AppResult, UserFacing};
use std::os::windows::{io::AsRawHandle, process::CommandExt};
use std::{
    io::{Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration,
};

pub struct LocalSpeech {
    _performance: std::sync::Arc<std::os::windows::io::OwnedHandle>,
    child: Child,
    input: mpsc::SyncSender<Vec<u8>>,
    replies: mpsc::Receiver<AppResult<String>>,
    // Windows closes this non-inherited handle on app crash, killing the helper.
    _job: windows::Win32::Foundation::HANDLE,
}
// HANDLE is owned here, never shared and closed once in Drop.
unsafe impl Send for LocalSpeech {}
#[derive(serde::Deserialize)]
pub struct SpeechUpdate {
    pub text: String,
    #[serde(rename = "final")]
    pub is_final: bool,
}
impl LocalSpeech {
    pub fn open(
        runtime: &Path,
        model: &Path,
        performance: &super::performance::Performance,
    ) -> AppResult<Self> {
        let mut child = Command::new(runtime.join("asr-worker.exe"))
            .arg(runtime)
            .arg(model)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .creation_flags(0x08000000)
            .spawn()
            .user_error("Cannot start local speech recognition. Reinstall LectureRelay.")?;
        let (job, performance) = match performance
            .register(&child)
            .and_then(|policy| contain_worker(&child).map(|job| (job, policy)))
        {
            Ok(value) => value,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let mut input = child
            .stdin
            .take()
            .ok_or("Local speech input unavailable.")?;
        let mut output = child
            .stdout
            .take()
            .ok_or("Local speech output unavailable.")?;
        let (sender, replies) = mpsc::sync_channel(1);
        let (requests, packets) = mpsc::sync_channel::<Vec<u8>>(1);
        std::thread::spawn(move || {
            while let Ok(packet) = packets.recv() {
                if input
                    .write_all(&packet)
                    .and_then(|_| input.flush())
                    .is_err()
                {
                    break;
                }
            }
        });
        std::thread::spawn(move || {
            loop {
                let result = (|| {
                    let mut head = [0u8; 8];
                    output
                        .read_exact(&mut head)
                        .user_error("Local recognition stopped. Recording is preserved.")?;
                    let code = i32::from_le_bytes(head[..4].try_into().unwrap());
                    let size = u32::from_le_bytes(head[4..].try_into().unwrap()) as usize;
                    if size > 20000 {
                        return Err("Local speech response exceeds the limit.".into());
                    }
                    let mut bytes = vec![0; size];
                    output
                        .read_exact(&mut bytes)
                        .user_error("Local speech response interrupted.")?;
                    if code != 0 {
                        return Err("Local recognition failed. Recording is preserved; transcribe after class.".into());
                    }
                    String::from_utf8(bytes).user_error("Local speech returned invalid text.")
                })();
                let failed = result.is_err();
                if sender.send(result).is_err() || failed {
                    break;
                }
            }
        });
        let mut engine = Self {
            _performance: performance,
            child,
            input: requests,
            replies,
            _job: job,
        };
        engine.receive()?;
        Ok(engine)
    }
    fn receive(&mut self) -> AppResult<String> {
        match self.replies.recv_timeout(Duration::from_secs(30)) {
            Ok(result) => result,
            Err(_) => {
                let _ = self.child.kill();
                Err(
                    "Local recognition timed out. Recording continues; transcribe after class."
                        .into(),
                )
            }
        }
    }
    pub fn transcribe(&mut self, samples: &[i16], rate: u32) -> AppResult<String> {
        self.send(samples, rate, 0)
    }
    pub fn set_glossary(&mut self, terms: &[String]) -> AppResult<()> {
        let mut bytes = Vec::new();
        for term in terms.iter().take(64) {
            let clean: String = term.chars().filter(|c| !c.is_control()).take(128).collect();
            if bytes.len() + clean.len() + 1 > 16384 {
                break;
            }
            bytes.extend_from_slice(clean.as_bytes());
            bytes.push(0);
        }
        let mut packet = (((3u32) << 30) | bytes.len() as u32).to_le_bytes().to_vec();
        packet.extend(bytes);
        self.input
            .try_send(packet)
            .user_error("Cannot set speech glossary.")?;
        self.receive().map(|_| ())
    }
    pub fn feed(&mut self, samples: &[i16], rate: u32) -> AppResult<SpeechUpdate> {
        let text = self.send(samples, rate, 1)?;
        serde_json::from_str(&text).user_error("Invalid local streaming response.")
    }
    pub fn finish(&mut self) -> AppResult<SpeechUpdate> {
        self.input
            .try_send((2u32 << 30).to_le_bytes().to_vec())
            .user_error("Local speech stopped.")?;
        serde_json::from_str(&self.receive()?).user_error("Invalid local streaming response.")
    }
    fn send(&mut self, samples: &[i16], rate: u32, command: u32) -> AppResult<String> {
        if rate == 0 || samples.len() as u64 > rate as u64 * 60 {
            return Err("Invalid local speech chunk.".into());
        }
        let count = (samples.len() as u64 * 16000 / rate as u64) as usize;
        if count == 0 {
            return Ok(String::new());
        }
        let mut bytes = Vec::with_capacity(count * 4 + 4);
        bytes.extend_from_slice(&((count as u32) | (command << 30)).to_le_bytes());
        for i in 0..count {
            let position = i as f64 * rate as f64 / 16000.0;
            let index = position as usize;
            let fraction = (position - index as f64) as f32;
            let a = samples[index.min(samples.len() - 1)] as f32;
            let b = samples[(index + 1).min(samples.len() - 1)] as f32;
            bytes.extend_from_slice(&((a + (b - a) * fraction) / 32768.0).to_le_bytes());
        }
        self.input
            .try_send(bytes)
            .user_error("Local recognition stopped. Recording is preserved.")?;
        self.receive()
    }
    pub fn process_id(&self) -> u32 {
        self.child.id()
    }
}
impl Drop for LocalSpeech {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self._job);
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn contain_worker(child: &Child) -> AppResult<windows::Win32::Foundation::HANDLE> {
    use windows::Win32::{
        Foundation::{CloseHandle, HANDLE},
        System::JobObjects::*,
    };
    unsafe {
        let job = CreateJobObjectW(None, None).user_error("Cannot contain local speech worker.")?;
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let result = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const std::ffi::c_void,
            std::mem::size_of_val(&limits) as u32,
        )
        .and_then(|_| AssignProcessToJobObject(job, HANDLE(child.as_raw_handle())));
        if result.is_err() {
            let _ = CloseHandle(job);
            return Err("Cannot safely start local speech worker.".into());
        }
        Ok(job)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires the pinned native SDK and downloaded evaluation model"]
    fn native_stream_resamples_finalizes_and_reports_worker_crash() {
        let project = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let runtime = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/local-asr");
        let model = project
            .join("target/asr-evaluation/models")
            .join(crate::models::manager::MODEL_FILE);
        let performance = super::super::performance::Performance::new(true).unwrap();
        let mut engine = LocalSpeech::open(&runtime, &model, &performance).unwrap();
        let affinity = || {
            let (mut mask, mut system) = (0usize, 0usize);
            unsafe {
                windows::Win32::System::Threading::GetProcessAffinityMask(
                    windows::Win32::Foundation::HANDLE(engine.child.as_raw_handle()),
                    &mut mask,
                    &mut system,
                )
                .unwrap();
            }
            mask
        };
        let quiet_mask = affinity();
        assert!(quiet_mask.count_ones() <= 4);
        performance.save(false, || Ok(())).unwrap();
        let full_mask = affinity();
        assert_eq!(full_mask & quiet_mask, quiet_mask);
        performance.save(true, || Ok(())).unwrap();
        assert_eq!(affinity(), quiet_mask);
        engine
            .set_glossary(&["Americans".into(), "country".into()])
            .unwrap();
        let reader =
            hound::WavReader::open(project.join("target/asr-evaluation/benchmark-data/jfk.wav"))
                .unwrap();
        let samples = reader
            .into_samples::<i16>()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let mut text = String::new();
        let mut partials = 0;
        for part in samples.chunks(32000) {
            let update = engine.feed(part, 16000).unwrap();
            if update.is_final {
                text.push_str(&update.text);
            } else if !update.text.is_empty() {
                partials += 1;
            }
        }
        text.push_str(&engine.finish().unwrap().text);
        assert!(partials > 0);
        assert!(text.to_lowercase().contains("country"));
        // Exercise the production native-rate conversion, not just 16 kHz input.
        let at_48k: Vec<i16> = samples.iter().flat_map(|sample| [*sample; 3]).collect();
        let mut resampled = String::new();
        for part in at_48k.chunks(96000) {
            let update = engine.feed(part, 48000).unwrap();
            if update.is_final {
                resampled.push_str(&update.text);
            }
        }
        resampled.push_str(&engine.finish().unwrap().text);
        assert!(resampled.to_lowercase().contains("country"));
        engine.child.kill().unwrap();
        engine.child.wait().unwrap();
        assert!(engine.feed(&samples[..32000], 16000).is_err());
    }
}
