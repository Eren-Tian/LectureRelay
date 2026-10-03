use super::*;
use crate::database::study::*;

#[tauri::command]
pub fn study_state(state: App<'_>, id: String) -> AppResult<StudyState> {
    state.storage.study_state(&id)
}
#[tauri::command]
pub fn save_note_draft(state: App<'_>, id: String, body: String) -> AppResult<()> {
    state.storage.save_draft(&id, &body)
}
#[tauri::command]
pub fn clear_note_draft(state: App<'_>, id: String) -> AppResult<()> {
    state.storage.clear_draft(&id)
}
#[tauri::command]
pub fn save_study_mark(
    state: App<'_>,
    id: String,
    seconds: f64,
    label: String,
    kind: String,
) -> AppResult<()> {
    state.storage.save_mark(&id, seconds, &label, &kind)
}
#[tauri::command]
pub fn delete_study_mark(state: App<'_>, lecture_id: String, id: String) -> AppResult<()> {
    state.storage.delete_mark(&lecture_id, &id)
}
#[tauri::command]
pub fn library_search(state: App<'_>, query: String) -> AppResult<Vec<LibraryEntry>> {
    state.storage.library(&query)
}
#[tauri::command]
pub fn pin_lecture(state: App<'_>, id: String, pinned: bool) -> AppResult<()> {
    state.storage.pin_lecture(&id, pinned)
}
#[tauri::command]
pub async fn import_media(
    state: App<'_>,
    course_id: String,
    title: String,
) -> AppResult<Option<Lecture>> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(source) = rfd::FileDialog::new()
            .set_title("Import lecture media")
            .add_filter(
                "Audio and video",
                &["wav", "mp3", "m4a", "mp4", "flac", "ogg"],
            )
            .pick_file()
        else {
            return Ok(None);
        };
        crate::app::media::import(&state, &course_id, &title, &source).map(Some)
    })
    .await
    .user_error("Media import could not finish.")?
}
#[tauri::command]
pub async fn attach_document(
    state: App<'_>,
    course_id: String,
) -> AppResult<Option<CourseDocument>> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state.storage.course(&course_id)?;
        let Some(source) = rfd::FileDialog::new()
            .set_title("Add local course PDF")
            .add_filter("PDF", &["pdf"])
            .pick_file()
        else {
            return Ok(None);
        };
        use std::io::Read;
        let _gate = state
            .gate
            .lock()
            .user_error("The app is busy. Try again.")?;
        state.storage.course(&course_id)?;
        let mut file = std::fs::File::open(&source).user_error("Cannot open PDF.")?;
        let mut bytes = Vec::new();
        file.by_ref()
            .take(50 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .user_error("Cannot read PDF.")?;
        if bytes.len() > 50 * 1024 * 1024 || !bytes.starts_with(b"%PDF-") {
            return Err("Choose a valid PDF smaller than 50 MiB.".into());
        }
        let id = new_id();
        let dir = state
            .paths
            .library
            .join("Courses")
            .join(&course_id)
            .join("Documents");
        std::fs::create_dir_all(&dir).user_error("Cannot create course documents folder.")?;
        let path = dir.join(format!("{id}.pdf"));
        crate::storage::write_atomic(&path, &bytes)?;
        let name = source
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .chars()
            .take(200)
            .collect::<String>();
        if let Err(e) = state
            .storage
            .add_document(&id, &course_id, &name, &path.to_string_lossy())
        {
            let _ = std::fs::remove_file(&path);
            return Err(e);
        }
        Ok(Some(CourseDocument {
            id,
            name,
            path: path.to_string_lossy().into(),
        }))
    })
    .await
    .user_error("Cannot attach course PDF.")?
}
#[tauri::command]
pub async fn read_document(
    state: App<'_>,
    course_id: String,
    id: String,
) -> AppResult<tauri::ipc::Response> {
    let document = state
        .storage
        .documents(&course_id)?
        .into_iter()
        .find(|d| d.id == id)
        .ok_or("Course document not found.")?;
    let bytes =
        std::fs::read(document.path).user_error("The local PDF is missing or unreadable.")?;
    if bytes.len() > 50 * 1024 * 1024 {
        return Err("PDF exceeds the supported size.".into());
    }
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn print_document(window: tauri::WebviewWindow) -> AppResult<()> {
    window.print().user_error("Cannot open the print dialog.")
}
#[tauri::command]
pub fn cancel_live_processing(state: App<'_>) -> AppResult<()> {
    if state.recorder.status()?.is_some() {
        return Err("Stop and save recording before cancelling final processing.".into());
    }
    state.live.cancel();
    Ok(())
}

#[tauri::command]
pub fn open_caption_window(app: tauri::AppHandle, state: App<'_>) -> AppResult<()> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("captions") {
        window.show().user_error("Cannot show captions.")?;
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "captions",
        tauri::WebviewUrl::App("index.html?panel=captions".into()),
    )
    .title("LectureRelay — Captions")
    .inner_size(660., 340.)
    .min_inner_size(380., 220.)
    .always_on_top(true)
    .focused(false)
    .theme(Some(if state.storage.settings()?.theme == "dark" {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    }))
    .build()
    .user_error("Cannot open caption window.")?;
    Ok(())
}
