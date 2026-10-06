mod live_translation;
pub(crate) mod local;
pub(crate) mod streaming;
mod translation_progress;

use crate::{
    error::AppResult,
    providers::{OfficialProvider, TranscriptionProvider},
};

pub fn configured(
    state: &crate::AppState,
    course_id: &str,
) -> AppResult<Box<dyn TranscriptionProvider>> {
    let settings = state.storage.settings()?;
    if settings.speech_provider == "local" {
        if !crate::models::manager::status(state)?.installed {
            return Err("Download the local speech model in Settings first.".into());
        }
        let mut engine = crate::speech::local::worker::LocalSpeech::open(
            &state.runtime,
            &crate::models::manager::path(state),
            &state.performance,
        )?;
        let terms = state
            .storage
            .glossary(course_id)?
            .into_iter()
            .map(|term| term.source)
            .collect::<Vec<_>>();
        engine.set_glossary(&terms)?;
        Ok(Box::new(local::provider::LocalProvider(
            std::sync::Arc::new(std::sync::Mutex::new(engine)),
        )))
    } else {
        let provider = if settings.speech_provider == "none" {
            &settings.provider
        } else {
            &settings.speech_provider
        };
        Ok(Box::new(OfficialProvider::new(
            provider,
            &settings.chat_model,
        )?))
    }
}
