use crate::providers::contracts::{SpeechCapabilities, SpeechSegment, TranscriptionProvider};
use crate::{
    error::{AppResult, UserFacing},
    speech::local::worker::LocalSpeech,
};
use std::sync::{Arc, Mutex};
pub struct LocalProvider(pub Arc<Mutex<LocalSpeech>>);
#[async_trait::async_trait]
impl TranscriptionProvider for LocalProvider {
    fn capabilities(&self) -> SpeechCapabilities {
        SpeechCapabilities {
            rolling_chunks: true,
            partial_results: false,
            context_hint: true,
        }
    }
    async fn transcribe(&self, wav: Vec<u8>, _context: &str) -> AppResult<Vec<SpeechSegment>> {
        let engine = self.0.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let mut reader = hound::WavReader::new(std::io::Cursor::new(wav))
                .user_error("Invalid local speech audio.")?;
            let spec = reader.spec();
            if spec.channels != 1 || spec.bits_per_sample != 16 || spec.sample_rate == 0 {
                return Err("Unsupported local speech audio.".into());
            }
            let samples = reader
                .samples::<i16>()
                .collect::<hound::Result<Vec<_>>>()
                .user_error("Cannot read local speech audio.")?;
            let duration = samples.len() as f64 / spec.sample_rate as f64;
            let text = engine
                .lock()
                .user_error("Local recognition unavailable.")?
                .transcribe(&samples, spec.sample_rate)?;
            Ok(vec![SpeechSegment {
                start: 0.0,
                end: duration,
                text,
            }])
        })
        .await
        .user_error("Local speech worker unavailable.")?
    }
}
