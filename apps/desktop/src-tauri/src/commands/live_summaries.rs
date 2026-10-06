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
            .ok_or("找不到总结卡片。")?;
        let source = card
            .sources
            .iter()
            .find(|s| s.id == source_id)
            .ok_or("找不到对应原文。")?;
        let mut reader = hound::WavReader::open(state.paths.recording(&lecture.course_id, &id)?)
            .user_error("暂时无法读取录音，请稍后重试。")?;
        let spec = reader.spec();
        if spec.channels != 1
            || spec.sample_rate > 192000
            || spec.sample_rate == 0
            || spec.bits_per_sample != 16
            || spec.sample_format != hound::SampleFormat::Int
        {
            return Err("录音格式暂不支持片段回听。".into());
        }
        let start = (source.start_seconds * f64::from(spec.sample_rate)).floor() as u32;
        if start >= reader.duration() {
            return Err("这一段录音尚未写完，请稍后再回听。".into());
        }
        reader.seek(start).user_error("无法定位录音片段。")?;
        let count = ((source.end_seconds - source.start_seconds).clamp(0.0, 60.0)
            * f64::from(spec.sample_rate))
        .ceil() as usize;
        let samples = reader
            .samples::<i16>()
            .take(count)
            .collect::<Result<Vec<_>, _>>()
            .user_error("读取录音片段失败，请稍后重试。")?;
        Ok(tauri::ipc::Response::new(crate::audio::wav::encode_chunk(
            &samples, spec,
        )?))
    })
    .await
    .user_error("无法读取录音片段。")?
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
    let providers = ["groq", "openai"]
        .into_iter()
        .map(credentials::status)
        .collect::<AppResult<Vec<_>>>()?;
    let connection_tested = state
        .storage
        .summary_test_matches(&preferences.provider, &preferences.model)?
        && providers
            .iter()
            .any(|p| p.provider == preferences.provider && p.has_key);
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
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    let mut settings = state.storage.settings()?;
    if preferences.enabled
        && matches!(preferences.provider.as_str(), "groq" | "openai")
        && (!credentials::status(&preferences.provider)?.has_key
            || !state
                .storage
                .summary_test_matches(&preferences.provider, &preferences.model)?)
    {
        return Err("请先保存 API Key，再点击“测试总结连接”；成功后即可启用。".into());
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
    provider: String,
    model: String,
) -> AppResult<()> {
    if !matches!(provider.as_str(), "groq" | "openai") {
        return Err("请选择 Groq 或 OpenAI。".into());
    }
    let preferences = LiveSummaryPreferences {
        provider: provider.clone(),
        model: model.clone(),
        ..Default::default()
    };
    preferences.validate()?;
    let _flight = state.summaries.test_flight()?;
    state.summaries.check_cooldown(&provider)?;
    let generation = state.summaries.generation();
    state.storage.summary_tested(&provider, None)?;
    let card=crate::database::live_summaries::SummaryCard {id:"connection-test".into(),lecture_id:String::new(),provider:provider.clone(),model:model.clone(),language:"zh".into(),sources:vec![crate::database::live_summaries::SummarySource {id:"test-source".into(),start_seconds:0.0,end_seconds:10.0,text:"This is a connection test. There are 3 examples. Do not claim that a recording was uploaded.".into(),revision:0}],state:String::new(),title:String::new(),points:vec![],message:String::new(),created_at:now()};
    let (system, user) = summaries::prompt(&card, "");
    let text = tokio::time::timeout(
        std::time::Duration::from_secs(45),
        OfficialProvider::new(&provider, &model)?.classroom_summary(&system, &user),
    )
    .await
    .map_err(|_| "总结连接测试超时，请检查网络后重试。")?
    .map_err(|e| {
        state.summaries.rate_limited(&provider, e.retry_after);
        e.message
    })?;
    summaries::parse(&text, &card)?;
    let _gate = state.gate.lock().user_error("应用正忙，请稍后重试。")?;
    if !state.summaries.matches_generation(generation) {
        return Err("测试期间 Key 或总结设置已更改，请重新测试。".into());
    }
    state.storage.summary_tested(&provider, Some(&model))
}
#[tauri::command]
pub fn open_summary_provider_page(provider: String, kind: String) -> AppResult<()> {
    let url = match (provider.as_str(), kind.as_str()) {
        ("groq", "keys") => "https://console.groq.com/keys",
        ("groq", "privacy") => "https://console.groq.com/docs/your-data",
        ("groq", "limits") => "https://console.groq.com/settings/limits",
        ("openai", "keys") => "https://platform.openai.com/api-keys",
        ("openai", "privacy") => "https://developers.openai.com/api/docs/guides/your-data",
        ("openai", "limits") => "https://platform.openai.com/settings/organization/limits",
        _ => return Err("无法打开此服务页面。".into()),
    };
    use std::os::windows::process::CommandExt;
    std::process::Command::new("explorer.exe")
        .arg(url)
        .creation_flags(0x08000000)
        .spawn()
        .user_error("无法打开系统浏览器，请检查默认浏览器设置。")?;
    Ok(())
}
