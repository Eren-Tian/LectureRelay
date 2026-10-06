use super::*;
use crate::app::live_summaries as summaries;
use serde::Serialize;
#[tauri::command]
pub async fn summary_audio(
    state: App<'_>,
    id: String,
    card_id: String,
    source_id: String,
) -> AppResult<tauri::ipc::Response> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let lecture = state.storage.lecture(&id)?;
        let card = state
            .storage
            .summary_cards(&id)?
            .into_iter()
            .find(|c| c.id == card_id)
            .ok_or("Summary card not found.")?;
        let source = card
            .sources
            .iter()
            .find(|s| s.id == source_id)
            .ok_or("The source text was not found.")?;
        let mut reader = hound::WavReader::open(state.paths.recording(&lecture.course_id, &id)?)
            .user_error("The recording cannot be read right now. Try again later.")?;
        let spec = reader.spec();
        if spec.channels != 1
            || spec.sample_rate > 192000
            || spec.sample_rate == 0
            || spec.bits_per_sample != 16
            || spec.sample_format != hound::SampleFormat::Int
        {
            return Err("This recording format does not support section playback.".into());
        }
        let start = (source.start_seconds * f64::from(spec.sample_rate)).floor() as u32;
        if start >= reader.duration() {
            return Err(
                "This part of the recording is not finished yet. Play it again later.".into(),
            );
        }
        reader
            .seek(start)
            .user_error("Cannot locate the recording section.")?;
        let count = ((source.end_seconds - source.start_seconds).clamp(0.0, 60.0)
            * f64::from(spec.sample_rate))
        .ceil() as usize;
        let samples = reader
            .samples::<i16>()
            .take(count)
            .collect::<Result<Vec<_>, _>>()
            .user_error("Reading the recording section failed. Try again later.")?;
        Ok(tauri::ipc::Response::new(crate::audio::wav::encode_chunk(
            &samples, spec,
        )?))
    })
    .await
    .user_error("Cannot read the recording section.")?
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarySetup {
    pub preferences: LiveSummaryPreferences,
    pub providers: Vec<ProviderStatus>,
    pub connection_tested: bool,
}
#[tauri::command]
pub fn live_summary_state(state: App<'_>, id: String) -> AppResult<summaries::SummaryState> {
    summaries::snapshot(&state, &id)
}
#[tauri::command]
pub fn live_summary_setup(state: App<'_>) -> AppResult<SummarySetup> {
    let preferences = state.storage.settings()?.live_summaries;
    let providers = [CloudProvider::Groq, CloudProvider::OpenAi]
        .into_iter()
        .map(credentials::status)
        .collect::<AppResult<Vec<_>>>()?;
    let connection_tested = match preferences.provider.cloud() {
        Some(provider) => {
            state
                .storage
                .summary_test_matches(provider, &preferences.model)?
                && providers
                    .iter()
                    .any(|p| p.provider == provider && p.has_key)
        }
        None => false,
    };
    Ok(SummarySetup {
        preferences,
        providers,
        connection_tested,
    })
}
#[tauri::command]
pub fn save_live_summary_settings(
    state: App<'_>,
    preferences: LiveSummaryPreferences,
) -> AppResult<()> {
    preferences.validate()?;
    let _gate = state.lock_gate();
    let mut settings = state.storage.settings()?;
    if preferences.enabled
        && let Some(provider) = preferences.provider.cloud()
        && (!credentials::status(provider)?.has_key
            || !state
                .storage
                .summary_test_matches(provider, &preferences.model)?)
    {
        return Err("Save the API key, then select Test summary connection; summaries can be enabled after it succeeds.".into());
    }
    if settings.live_summaries.enabled != preferences.enabled
        || settings.live_summaries.provider != preferences.provider
        || settings.live_summaries.model != preferences.model
        || settings.live_summaries.upload_consent != preferences.upload_consent
    {
        state.summaries.cancel();
    }
    settings.live_summaries = preferences;
    state.storage.save_settings(settings)
}
#[tauri::command]
pub async fn summarize_now(
    app: tauri::AppHandle,
    state: App<'_>,
    id: String,
    card_id: Option<String>,
) -> AppResult<()> {
    summaries::run(&state, &app, &id, card_id.as_deref(), true).await
}
#[tauri::command]
pub async fn test_summary_provider(
    state: App<'_>,
    provider: CloudProvider,
    model: String,
) -> AppResult<()> {
    let preferences = LiveSummaryPreferences {
        provider: provider.into(),
        model: model.clone(),
        ..Default::default()
    };
    preferences.validate()?;
    let _flight = state.summaries.test_flight()?;
    state.summaries.check_cooldown(provider)?;
    let generation = state.summaries.generation();
    state.storage.summary_tested(provider, None)?;
    // i18n-exempt: sample source text sent to the model
    let card=crate::database::live_summaries::SummaryCard {id:"connection-test".into(),lecture_id:String::new(),provider:provider.as_str().into(),model:model.clone(),language:"zh".into(),sources:vec![crate::database::live_summaries::SummarySource {id:"test-source".into(),start_seconds:0.0,end_seconds:10.0,text:"This is a connection test. There are 3 examples. Do not claim that a recording was uploaded.".into(),revision:0}],state:String::new(),title:String::new(),points:vec![],message:String::new(),created_at:now()};
    let (system, user) = summaries::prompt(&card, "");
    let text = tokio::time::timeout(
        std::time::Duration::from_secs(45),
        OfficialProvider::new(provider, &model)?.classroom_summary(&system, &user),
    )
    .await
    .map_err(|_| "The summary connection test timed out. Check your network and try again.")?
    .map_err(|e| {
        state.summaries.rate_limited(provider, e.retry_after);
        e.message
    })?;
    summaries::parse(&text, &card)?;
    let _gate = state.lock_gate();
    if !state.summaries.matches_generation(generation) {
        return Err("The key or summary settings changed during the test. Test again.".into());
    }
    state.storage.summary_tested(provider, Some(&model))
}
#[tauri::command]
pub fn open_summary_provider_page(provider: CloudProvider, kind: String) -> AppResult<()> {
    use CloudProvider::{Groq, OpenAi};
    let url = match (provider, kind.as_str()) {
        (Groq, "keys") => "https://console.groq.com/keys",
        (Groq, "privacy") => "https://console.groq.com/docs/your-data",
        (Groq, "limits") => "https://console.groq.com/settings/limits",
        (OpenAi, "keys") => "https://platform.openai.com/api-keys",
        (OpenAi, "privacy") => "https://developers.openai.com/api/docs/guides/your-data",
        (OpenAi, "limits") => "https://platform.openai.com/settings/organization/limits",
        _ => return Err("Cannot open this service page.".into()),
    };
    use std::os::windows::process::CommandExt;
    std::process::Command::new("explorer.exe")
        .arg(url)
        .creation_flags(0x08000000)
        .spawn()
        .user_error("Cannot open the system browser. Check your default browser setting.")?;
    Ok(())
}
