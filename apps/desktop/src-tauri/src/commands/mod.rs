use tauri::Emitter;
pub(crate) mod study;
use crate::{
    AppState,
    app::assistance as ai,
    app::jobs::{JobGuard, JobStatus},
    audio::{InputDevice, RecordingStatus},
    domain::*,
    error::{AppResult, UserFacing},
    providers::OfficialProvider,
    security::credentials,
    storage::StorageInfo,
};
use std::sync::Arc;
use tauri::State;

type App<'a> = State<'a, Arc<AppState>>;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    courses: Vec<Course>,
    settings: AppSettings,
    storage: StorageInfo,
    providers: Vec<ProviderStatus>,
    recording: Option<RecordingStatus>,
    job: Option<JobStatus>,
    recovered_count: usize,
}

#[derive(serde::Serialize)]
pub struct CourseDetail {
    course: Course,
    lectures: Vec<Lecture>,
    glossary: Vec<GlossaryTerm>,
}

#[tauri::command]
pub fn bootstrap(state: App<'_>) -> AppResult<Bootstrap> {
    let providers = ["openai", "groq"]
        .into_iter()
        .map(|provider| {
            credentials::status(provider).unwrap_or(ProviderStatus {
                provider: provider.into(),
                has_key: false,
                masked_key: String::new(),
            })
        })
        .collect();
    Ok(Bootstrap {
        courses: state.storage.courses()?,
        settings: state.storage.settings()?,
        storage: state.paths.info(),
        providers,
        recording: state.recorder.status()?,
        job: state.jobs.status()?,
        recovered_count: state.recovered_count,
    })
}

#[tauri::command]
pub fn course_detail(state: App<'_>, id: String) -> AppResult<CourseDetail> {
    Ok(CourseDetail {
        course: state.storage.course(&id)?,
        lectures: state.storage.lectures(&id)?,
        glossary: state.storage.glossary(&id)?,
    })
}

#[tauri::command]
pub fn save_course(state: App<'_>, id: Option<String>, input: CourseInput) -> AppResult<Course> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    state.storage.save_course(id, input)
}

#[tauri::command]
pub fn delete_course(state: App<'_>, id: String) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    if state.live.active() {
        return Err("Wait for live caption processing to finish.".into());
    }
    if let Some(recording) = state.recorder.status()?
        && state.storage.lecture(&recording.lecture_id)?.course_id == id
    {
        return Err("Stop recording this course first.".into());
    }
    if let Some(job) = state.jobs.status()?
        && state.storage.lecture(&job.lecture_id)?.course_id == id
    {
        return Err("A task is running for this course. Cancel it or wait for completion.".into());
    }
    state.storage.delete_course(&id)
}

#[tauri::command]
pub fn save_term(
    state: App<'_>,
    course_id: String,
    id: Option<String>,
    source: String,
    translation: String,
) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    state
        .storage
        .save_term(&course_id, id, &source, &translation)
}

#[tauri::command]
pub fn delete_term(state: App<'_>, course_id: String, id: String) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    state.storage.delete_term(&course_id, &id)
}

#[tauri::command]
pub async fn input_devices() -> AppResult<Vec<InputDevice>> {
    tauri::async_runtime::spawn_blocking(crate::audio::input_devices)
        .await
        .user_error("Cannot check audio devices.")?
}

#[tauri::command]
pub async fn test_audio_input(
    app: tauri::AppHandle,
    state: App<'_>,
    id: String,
    source: String,
    device_id: String,
) -> AppResult<f32> {
    use std::sync::atomic::Ordering;
    let state = state.inner().clone();
    {
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        if !matches!(source.as_str(), "microphone" | "system")
            || id.len() > 64
            || device_id.len() > 2048
        {
            return Err("Choose a valid audio source and device.".into());
        }
        if state.recorder.status()?.is_some()
            || state.live.active()
            || state.jobs.status()?.is_some()
        {
            return Err("Finish active recording or processing before testing audio.".into());
        }
        if state.audio_preview.swap(true, Ordering::Relaxed) {
            return Err("An audio test is already running. It finishes after five seconds.".into());
        }
    }
    struct Reset(Arc<AppState>);
    impl Drop for Reset {
        fn drop(&mut self) {
            self.0.audio_preview.store(false, Ordering::Relaxed);
        }
    }
    let guard = Reset(state);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        crate::audio::preview::test(&app, id, source, device_id)
    })
    .await
    .user_error("Cannot test the audio input.")?
}

#[tauri::command]
pub async fn start_lecture(
    app: tauri::AppHandle,
    state: App<'_>,
    course_id: String,
    title: String,
    device_id: String,
    source: String,
) -> AppResult<Lecture> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        if !matches!(source.as_str(), "microphone" | "system") {
            return Err("Choose Microphone or System Audio.".into());
        }
        if state
            .audio_preview
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return Err("Wait for the five-second audio test to finish before recording.".into());
        }
        if state.live.active() || crate::models::manager::downloading(&state)? {
            return Err("Wait for caption processing or model download to finish.".into());
        }
        let settings = state.storage.settings()?;
        if settings.speech_provider == "local" && !crate::models::manager::status(&state)?.installed
        {
            return Err(
                "Download the local speech model in Settings → Local AI before class.".into(),
            );
        }
        if matches!(settings.speech_provider.as_str(), "openai" | "groq")
            && !credentials::status(&settings.speech_provider)?.has_key
        {
            return Err("Add your speech provider key in Settings before class.".into());
        }
        if state.recorder.status()?.is_some() {
            return Err("A lecture is already recording.".into());
        }
        if state.jobs.status()?.is_some() || state.live.active() {
            return Err("Cancel or finish the AI task before starting a lecture.".into());
        }
        let mut lecture = state
            .storage
            .create_lecture(&state.paths, &course_id, &title)?;
        // Persist all startup metadata before owning a live device. A database
        // error must not leave a recording running behind a failed Start request.
        if let Err(error) = state
            .storage
            .set_audio_source(&lecture.id, &source)
            .and_then(|()| state.storage.snapshot(&state.paths, &lecture.id))
        {
            state.storage.finish_lecture(&lecture.id, 0.0, "failed")?;
            return Err(error);
        }
        lecture.audio_source = source.clone();
        let recording = state.paths.recording(&course_id, &lecture.id)?;
        let recovery = state
            .paths
            .data
            .join("recovery")
            .join(format!("{}.json", lecture.id));
        if let Err(error) = state.recorder.start(
            app.clone(),
            lecture.id.clone(),
            recording,
            recovery,
            device_id,
            source.clone(),
        ) {
            state.storage.finish_lecture(&lecture.id, 0.0, "failed")?;
            state.storage.snapshot(&state.paths, &lecture.id)?;
            return Err(error);
        }
        if settings.speech_provider != "none" {
            crate::speech::streaming::Live::start(state.clone(), app, lecture.id.clone());
        }
        Ok(lecture)
    })
    .await
    .user_error("Cannot start lecture recording.")?
}

#[tauri::command]
pub fn pause_lecture(state: App<'_>, id: String, paused: bool) -> AppResult<()> {
    state.recorder.pause(&id, paused)
}

#[tauri::command]
pub async fn stop_lecture(state: App<'_>, id: String) -> AppResult<Lecture> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || stop_recording(&state, &id))
        .await
        .user_error("Cannot save the lecture. Written audio is preserved.")?
}

pub(crate) fn stop_recording(state: &AppState, id: &str) -> AppResult<Lecture> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    let lecture = state.storage.lecture(id)?;
    match state.recorder.status()? {
        Some(recording) if recording.lecture_id == id => {}
        Some(_) => {
            return Err("Another lecture is recording. Open that lecture to stop it.".into());
        }
        None if lecture.status != "recording" => return Ok(lecture),
        None => {
            return Err("This recording is not active. Restart to recover its saved audio.".into());
        }
    }
    let summary = state.recorder.stop(id);
    let (duration, status) = match summary {
        Ok(summary) => (
            summary.duration_seconds,
            if summary.error.is_some() {
                "interrupted"
            } else {
                "completed"
            },
        ),
        Err(_) => {
            let duration = hound::WavReader::open(state.paths.recording(&lecture.course_id, id)?)
                .map(|reader| reader.duration() as f64 / reader.spec().sample_rate as f64)
                .unwrap_or(0.0);
            (duration, "interrupted")
        }
    };
    state.live.finish();
    state.storage.finish_lecture(id, duration, status)?;
    state.storage.snapshot(&state.paths, id)?;
    let _ = std::fs::remove_file(state.paths.data.join("recovery").join(format!("{id}.json")));
    state.storage.lecture(id)
}

#[tauri::command]
pub fn recording_status(state: App<'_>) -> AppResult<Option<RecordingStatus>> {
    state.recorder.status()
}

#[tauri::command]
pub fn lecture_detail(state: App<'_>, id: String) -> AppResult<LectureDetail> {
    let mut detail = state.storage.detail(&id)?;
    detail.recording_warning =
        crate::audio::saved_warning(&state.paths.recording(&detail.lecture.course_id, &id)?);
    Ok(detail)
}

#[tauri::command]
pub fn save_segment(
    state: App<'_>,
    lecture_id: String,
    id: Option<String>,
    input: SegmentInput,
) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    ensure_ended(&state, &lecture_id)?;
    if state.jobs.status()?.is_some() || state.live.active() {
        return Err("Wait for the AI task before editing the transcript.".into());
    }
    state.storage.save_segment(&lecture_id, id, input)?;
    state.storage.snapshot(&state.paths, &lecture_id)
}

#[tauri::command]
pub fn save_note(state: App<'_>, lecture_id: String, body: String) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    state.storage.lecture(&lecture_id)?;
    if let Some(previous) = state.storage.note(&lecture_id)?
        && previous.body != body
    {
        let lecture = state.storage.lecture(&lecture_id)?;
        let language = state
            .storage
            .course(&lecture.course_id)?
            .assistance_language;
        state.storage.add_note_version(
            &lecture_id,
            &previous.body,
            &previous.origin,
            &language,
            &state.storage.source_version(&lecture_id)?,
        )?;
    }
    state.storage.save_note(&lecture_id, &body, "manual")?;
    state.storage.clear_draft(&lecture_id)?;
    state.storage.snapshot(&state.paths, &lecture_id)
}

#[tauri::command]
pub fn save_settings(state: App<'_>, mut settings: AppSettings) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    if state.jobs.status()?.is_some()
        || state.live.active()
        || state.recorder.status()?.is_some()
        || crate::models::manager::downloading(&state)?
    {
        return Err("Wait for active work before changing preferences.".into());
    }
    // Runtime preferences are saved independently, including during recording.
    let current = state.storage.settings()?;
    settings.theme = current.theme;
    settings.quiet_mode = current.quiet_mode;
    state.storage.save_settings(settings)
}

#[tauri::command]
pub fn save_runtime_preferences(
    window: tauri::WebviewWindow,
    state: App<'_>,
    theme: Option<String>,
    quiet_mode: Option<bool>,
) -> AppResult<AppSettings> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    let mut settings = state.storage.settings()?;
    if let Some(theme) = theme {
        settings.theme = theme;
    }
    if let Some(quiet) = quiet_mode {
        settings.quiet_mode = quiet;
    }
    state.performance.save(settings.quiet_mode, || {
        state.storage.save_settings(settings.clone())
    })?;
    let _ = window.set_theme(Some(if settings.theme == "dark" {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    }));
    Ok(settings)
}

#[tauri::command]
pub fn save_provider_key(provider: String, key: String) -> AppResult<()> {
    credentials::save(&provider, key)
}

#[tauri::command]
pub fn remove_provider_key(provider: String) -> AppResult<()> {
    credentials::remove(&provider)
}

#[tauri::command]
pub fn provider_status(provider: String) -> AppResult<ProviderStatus> {
    credentials::status(&provider)
}

#[tauri::command]
pub async fn test_provider(state: App<'_>, provider: String, model: String) -> AppResult<()> {
    let _job = {
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        if state.recorder.status()?.is_some()
            || state.live.active()
            || crate::models::manager::downloading(&state)?
        {
            return Err("Test provider connections after active work ends.".into());
        }
        state.jobs.begin("", "provider-test")?
    };
    OfficialProvider::new(&provider, &model)?.test().await
}

fn ensure_ended(state: &AppState, id: &str) -> AppResult<()> {
    if state.storage.lecture(id)?.status == "recording" {
        return Err("Stop and save the lecture first.".into());
    }
    Ok(())
}

fn begin_job<'a>(state: &'a AppState, id: &str, kind: &str) -> AppResult<JobGuard<'a>> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    if state.live.active() || crate::models::manager::downloading(state)? {
        return Err("Wait for live captions or model download to finish.".into());
    }
    if state.recorder.status()?.is_some() {
        return Err("Run this AI task after recording ends.".into());
    }
    ensure_ended(state, id)?;
    state.jobs.begin(id, kind)
}

#[tauri::command]
pub async fn transcribe_lecture(state: App<'_>, id: String, translate: bool) -> AppResult<()> {
    let _job = begin_job(&state, &id, "transcription")?;
    let result = ai::transcribe(&state, &id, translate).await;
    _job.finish(&result)?;
    result
}

#[tauri::command]
pub async fn translate_lecture(state: App<'_>, id: String) -> AppResult<()> {
    let _job = begin_job(&state, &id, "translation")?;
    let result = ai::translate_all(&state, &id).await;
    _job.finish(&result)?;
    result
}

#[tauri::command]
pub async fn generate_notes(state: App<'_>, id: String) -> AppResult<()> {
    let _job = begin_job(&state, &id, "notes")?;
    let result = ai::notes(&state, &id).await;
    _job.finish(&result)?;
    result
}

#[tauri::command]
pub async fn generate_review(state: App<'_>, id: String, request: String) -> AppResult<()> {
    if request.trim().is_empty() {
        return Err("Describe what you want to review.".into());
    }
    let job = begin_job(&state, &id, "review")?;
    let result = ai::review(&state, &id, &request).await;
    job.finish(&result)?;
    result
}

#[tauri::command]
pub async fn resume_review(state: App<'_>, id: String, review_id: String) -> AppResult<()> {
    let job = begin_job(&state, &id, "review")?;
    let result = crate::app::review::run(&state, &id, "", Some(&review_id)).await;
    job.finish(&result)?;
    result
}

#[tauri::command]
pub fn local_text_models(state: App<'_>) -> AppResult<Vec<crate::models::manager::ModelStatus>> {
    [
        crate::models::catalog::TRANSLATION,
        crate::models::catalog::STUDY,
    ]
    .into_iter()
    .map(|id| crate::models::manager::status_for(&state, id))
    .collect()
}

#[tauri::command]
pub async fn download_text_model(
    state: App<'_>,
    app: tauri::AppHandle,
    id: String,
) -> AppResult<()> {
    crate::models::manager::download_model_with(&state, &id, |status| {
        let _ = app.emit("model-status", status);
    })
    .await
}

#[tauri::command]
pub fn remove_text_model(state: App<'_>, id: String) -> AppResult<()> {
    crate::models::manager::remove_model(&state, &id)
}

#[tauri::command]
pub async fn ask_lecture(state: App<'_>, id: String, question: String) -> AppResult<Answer> {
    let _job = begin_job(&state, &id, "question")?;
    let result = ai::answer(&state, &id, &question).await;
    _job.finish(&result)?;
    result
}

#[tauri::command]
pub fn job_status(state: App<'_>) -> AppResult<Option<JobStatus>> {
    state.jobs.status()
}

#[tauri::command]
pub fn cancel_job(state: App<'_>) {
    state.jobs.cancel();
}

#[tauri::command]
pub fn export_lecture(state: App<'_>, id: String, kind: String) -> AppResult<String> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    let detail = state.storage.detail(&id)?;
    let (extension, content) = match kind.as_str() {
        "srt-source" | "srt-translation" | "srt-bilingual" | "vtt-source" | "vtt-translation"
        | "vtt-bilingual" => {
            let (format, language) = kind.split_once('-').ok_or("Invalid subtitle format.")?;
            (
                format,
                crate::app::exports::subtitles(&detail.segments, format == "vtt", language)?,
            )
        }
        "notes" => (
            "md",
            detail.note.ok_or("This lecture has no notes yet.")?.body,
        ),
        "transcript-json" => (
            "json",
            serde_json::to_string_pretty(&detail.segments)
                .user_error("Cannot encode transcript export.")?,
        ),
        "transcript-markdown" => {
            let body = detail
                .segments
                .iter()
                .map(|s| {
                    format!(
                        "### {}\n\n{}\n\n{}\n",
                        ai::timestamp(s.start_seconds),
                        s.source_text,
                        s.translated_text
                    )
                })
                .collect::<Vec<_>>()
                .join("\n");
            ("md", format!("# {}\n\n{}", detail.lecture.title, body))
        }
        _ => return Err("Unsupported export format.".into()),
    };
    let path =
        state
            .paths
            .library
            .join("Exports")
            .join(format!("{id}-{kind}-{}.{}", now(), extension));
    crate::storage::write_atomic(&path, content.as_bytes())?;
    Ok(path.to_string_lossy().into())
}

#[tauri::command]
pub fn open_data_folder(state: App<'_>, kind: String) -> AppResult<()> {
    let path = match kind.as_str() {
        "library" => state.paths.library.clone(),
        "exports" => state.paths.library.join("Exports"),
        "state" => state.paths.data.clone(),
        _ => return Err("Invalid storage folder.".into()),
    };
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .user_error("Cannot open File Explorer.")?;
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle, state: App<'_>) -> AppResult<()> {
    if state.recorder.status()?.is_some() {
        return Err("Stop and save the recording first.".into());
    }
    state.jobs.cancel();
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn audio_devices(source: String) -> AppResult<Vec<InputDevice>> {
    if !matches!(source.as_str(), "microphone" | "system") {
        return Err("Invalid audio source.".into());
    }
    tauri::async_runtime::spawn_blocking(move || crate::audio::devices(&source))
        .await
        .user_error("Cannot list audio devices.")?
}
#[tauri::command]
pub fn live_status(state: App<'_>) -> AppResult<crate::speech::streaming::LiveStatus> {
    let mut status = state.live.snapshot()?;
    if let Some(recording) = state.recorder.status()?
        && recording.lecture_id == status.lecture_id
    {
        status.backlog_seconds = state.live.backlog(recording.duration_seconds);
    }
    Ok(status)
}
#[tauri::command]
pub fn local_model_status(state: App<'_>) -> AppResult<crate::models::manager::ModelStatus> {
    crate::models::manager::status(&state)
}
#[tauri::command]
pub async fn storage_usage(state: App<'_>) -> AppResult<crate::storage::usage::StorageUsage> {
    let paths = state.paths.clone();
    tauri::async_runtime::spawn_blocking(move || paths.usage())
        .await
        .map_err(|_| "Storage usage is unavailable.".to_string())?
}
#[tauri::command]
pub async fn download_local_model(state: App<'_>, app: tauri::AppHandle) -> AppResult<()> {
    crate::models::manager::download(&state, &app).await
}
#[tauri::command]
pub fn remove_local_model(state: App<'_>) -> AppResult<()> {
    crate::models::manager::remove(&state)
}
#[tauri::command]
pub fn cancel_model_download(state: App<'_>) {
    state
        .models
        .cancel
        .store(true, std::sync::atomic::Ordering::Relaxed);
}
#[tauri::command]
pub fn trash_courses(state: App<'_>) -> AppResult<Vec<Course>> {
    state.storage.trash()
}
#[tauri::command]
pub fn restore_course(state: App<'_>, id: String) -> AppResult<()> {
    let _gate = state
        .gate
        .lock()
        .user_error("The app is busy. Try again.")?;
    state.storage.restore_course(&id)
}

fn ensure_cleanup_idle(state: &AppState) -> AppResult<()> {
    if state.recorder.status()?.is_some()
        || state.jobs.status()?.is_some()
        || state.live.active()
        || state
            .audio_preview
            .load(std::sync::atomic::Ordering::Relaxed)
        || crate::models::manager::downloading(state)?
    {
        return Err(
            "Finish recording, processing, audio testing and downloads before deleting data."
                .into(),
        );
    }
    Ok(())
}

#[tauri::command]
pub fn existing_lecture_ids(state: App<'_>, ids: Vec<String>) -> AppResult<Vec<String>> {
    state.storage.existing_lecture_ids(&ids)
}
#[tauri::command]
pub async fn permanently_delete_lecture(
    state: App<'_>,
    id: String,
    confirmation: String,
) -> AppResult<()> {
    if confirmation != "DELETE" {
        return Err("Type DELETE to confirm permanent deletion.".into());
    }
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        ensure_cleanup_idle(&state)?;
        let result = crate::storage::cleanup::delete_lecture(&state.paths, &state.storage, &id);
        if let Ok(mut status) = state.live.status.lock()
            && status.lecture_id == id
            && state.storage.lecture(&id).is_err()
        {
            *status = Default::default();
        }
        result
    })
    .await
    .user_error("Lecture deletion was interrupted. Restart to recover cleanup.")?
}

#[tauri::command]
pub async fn permanently_delete_course(
    state: App<'_>,
    id: String,
    confirmation: String,
) -> AppResult<Vec<String>> {
    if confirmation != "DELETE" {
        return Err("Type DELETE to confirm permanent deletion.".into());
    }
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        ensure_cleanup_idle(&state)?;
        let result = crate::storage::cleanup::run(&state.paths, &state.storage, Some(&id));
        if let Ok(mut status) = state.live.status.lock()
            && !status.lecture_id.is_empty()
            && state.storage.lecture(&status.lecture_id).is_err()
        {
            *status = Default::default();
        }
        result
    })
    .await
    .user_error("Permanent deletion was interrupted. Restart to recover cleanup.")?
}
#[tauri::command]
pub async fn free_all_storage(state: App<'_>, confirmation: String) -> AppResult<Vec<String>> {
    if confirmation != "DELETE ALL" {
        return Err("Type DELETE ALL to confirm freeing all class storage.".into());
    }
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        ensure_cleanup_idle(&state)?;
        let result = crate::storage::cleanup::run(&state.paths, &state.storage, None);
        *state
            .models
            .active
            .lock()
            .user_error("Model status unavailable.")? = None;
        if let Ok(mut status) = state.live.status.lock() {
            *status = Default::default();
        }
        result
    })
    .await
    .user_error("Storage cleanup was interrupted. Restart to recover cleanup.")?
}
