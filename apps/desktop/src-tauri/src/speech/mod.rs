mod live_translation;
pub(crate) mod local;
mod recognition;
pub(crate) mod streaming;
mod translation_progress;
mod translation_worker;

use crate::{
    error::AppResult,
    providers::{OfficialProvider, TranscriptionProvider},
};

pub fn configured(
    state: &crate::AppState,
    course_id: &str,
) -> AppResult<Box<dyn TranscriptionProvider>> {
    let settings = state.storage.settings()?;
    if settings.speech_provider == crate::domain::SpeechEngine::Local {
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
        let provider = settings
            .speech_provider
            .cloud()
            .or(settings.provider.cloud())
            .ok_or("Choose an AI provider and add a key in Settings.")?;
        Ok(Box::new(OfficialProvider::new(
            provider,
            &settings.chat_model,
        )?))
    }
}
