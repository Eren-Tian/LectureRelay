use crate::{domain::TranscriptSegment, error::AppResult};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
pub struct Translation {
    pub id: String,
    pub text: String,
}

#[async_trait]
pub trait TranscriptionProvider: Send + Sync {
    fn capabilities(&self) -> SpeechCapabilities {
        SpeechCapabilities {
            rolling_chunks: true,
            partial_results: false,
            context_hint: true,
        }
    }
    async fn transcribe(&self, wav: Vec<u8>, context: &str) -> AppResult<Vec<SpeechSegment>>;
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechCapabilities {
    pub rolling_chunks: bool,
    pub partial_results: bool,
    pub context_hint: bool,
}

#[async_trait]
pub trait TranslationProvider: Send + Sync {
    async fn translate(
        &self,
        context: &str,
        segments: &[TranscriptSegment],
        language: &str,
    ) -> AppResult<Vec<Translation>>;
}

#[async_trait]
pub trait NotesProvider: Send + Sync {
    async fn notes(&self, context: &str, evidence: &str, language: &str) -> AppResult<String>;
    async fn combine_notes(&self, context: &str, notes: &str, language: &str) -> AppResult<String>;
}

#[async_trait]
pub trait QuestionAnsweringProvider: Send + Sync {
    async fn answer(
        &self,
        context: &str,
        evidence: &str,
        question: &str,
        language: &str,
    ) -> AppResult<String>;
}

pub trait Provider:
    TranscriptionProvider + TranslationProvider + NotesProvider + QuestionAnsweringProvider
{
}
impl<T> Provider for T where
    T: TranscriptionProvider + TranslationProvider + NotesProvider + QuestionAnsweringProvider
{
}

#[derive(Deserialize)]
pub struct SpeechSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}
