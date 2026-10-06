pub(crate) mod assistance;
pub(crate) mod exports;
pub(crate) mod jobs;
pub(crate) mod media;
pub(crate) mod review;

use crate::{
    audio, commands, database, models::manager as model_manager, speech::streaming as live, storage,
};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

pub struct AppState {
    pub(crate) audio_preview: std::sync::atomic::AtomicBool,
    pub(crate) performance: crate::speech::local::performance::Performance,
    pub(crate) storage: Arc<database::Storage>,
    pub(crate) paths: storage::AppPaths,
    pub(crate) recorder: audio::Recorder,
    pub(crate) jobs: jobs::Jobs,
    pub(crate) live: live::Live,
    pub(crate) models: model_manager::ModelManager,
    pub(crate) runtime: std::path::PathBuf,
    pub(crate) gate: Mutex<()>,
    pub(crate) recovered_count: usize,
    pub(crate) _instance_lock: std::fs::File,
}

pub fn run() {
    let result = tauri::Builder::default()
        .setup(|app| {
            let paths = storage::AppPaths::production()?;
            let instance_lock = paths.acquire_instance_lock()?;
            let storage = Arc::new(database::Storage::open(&paths.data.join("app.db"))?);
            storage::cleanup::recover(&paths, &storage)?;
            let recovered_count = storage.recover(&paths)?;
            let preferences = storage.settings()?;
            #[cfg(debug_assertions)]
            if std::env::var_os("LECTURERELAY_TEST_ROOT").is_some() {
                app.asset_protocol_scope()
                    .allow_directory(paths.library.join("Courses"), true)?;
            }
            let state = Arc::new(AppState {
                audio_preview: Default::default(),
                performance: crate::speech::local::performance::Performance::new(
                    preferences.quiet_mode,
                )?,
                storage: storage.clone(),
                paths: paths.clone(),
                recorder: Default::default(),
                jobs: jobs::Jobs::persistent(storage.clone()),
                live: Default::default(),
                models: Default::default(),
                runtime: {
                    #[cfg(debug_assertions)]
                    {
                        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                            .join("resources/local-asr")
                    }
                    #[cfg(not(debug_assertions))]
                    {
                        app.path().resource_dir()?.join("local-asr")
                    }
                },
                gate: Mutex::new(()),
                recovered_count,
                _instance_lock: instance_lock,
            });
            app.manage(state);
            let window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("LectureRelay")
            .theme(Some(if preferences.theme == "dark" {
                tauri::Theme::Dark
            } else {
                tauri::Theme::Light
            }))
            .inner_size(1180.0, 780.0)
            .min_inner_size(880.0, 620.0)
            .visible(false)
            .data_directory(paths.data.join("state").join("webview2"))
            .build()?;
            // Installed acceptance may request placement, never a data-root override.
            // Release storage still always uses the user's Windows Known Folders.
            if std::env::var("LECTURERELAY_TEST_PORTRAIT").as_deref() == Ok("1")
                || cfg!(debug_assertions) && std::env::var_os("LECTURERELAY_TEST_ROOT").is_some()
            {
                #[cfg(debug_assertions)]
                if std::env::var_os("LECTURERELAY_TEST_ROOT").is_some() {
                    window.set_title("LectureRelay — Isolated Test")?;
                }
                // Keep automated test windows on the user's portrait display before showing.
                if let Some(monitor) = window
                    .available_monitors()?
                    .into_iter()
                    .find(|m| m.size().height > m.size().width)
                {
                    window.set_position(tauri::PhysicalPosition::new(
                        monitor.position().x + 20,
                        monitor.position().y + 20,
                    ))?;
                    window.set_size(tauri::PhysicalSize::new(
                        monitor.size().width.saturating_sub(50),
                        monitor.size().height.saturating_sub(100),
                    ))?;
                }
            }
            // Show explicitly before focusing, including launches inherited from a hidden shell.
            window.show()?;
            window.unminimize()?;
            let _ = window.set_focus();
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                let state = window.state::<Arc<AppState>>();
                if state.recorder.status().ok().flatten().is_some() {
                    api.prevent_close();
                    if let Ok(Some(recording)) = state.recorder.status() {
                        let _ = window.emit("close-during-recording", recording.lecture_id);
                    }
                } else {
                    state.jobs.cancel();
                    state.live.cancel();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::study::open_caption_window,
            commands::study::close_caption_window,
            commands::study::caption_state,
            commands::study::pause_live_translation,
            commands::study::print_document,
            commands::study::cancel_live_processing,
            commands::study::study_state,
            commands::study::save_note_draft,
            commands::study::clear_note_draft,
            commands::study::save_study_mark,
            commands::study::delete_study_mark,
            commands::study::library_search,
            commands::study::pin_lecture,
            commands::study::import_media,
            commands::study::attach_document,
            commands::study::read_document,
            commands::bootstrap,
            commands::audio_devices,
            commands::live_status,
            commands::local_model_status,
            commands::download_local_model,
            commands::remove_local_model,
            commands::cancel_model_download,
            commands::trash_courses,
            commands::restore_course,
            commands::course_detail,
            commands::save_course,
            commands::delete_course,
            commands::permanently_delete_course,
            commands::permanently_delete_lecture,
            commands::free_all_storage,
            commands::existing_lecture_ids,
            commands::save_term,
            commands::delete_term,
            commands::input_devices,
            commands::test_audio_input,
            commands::start_lecture,
            commands::pause_lecture,
            commands::stop_lecture,
            commands::lecture_detail,
            commands::recording_status,
            commands::save_segment,
            commands::save_note,
            commands::save_settings,
            commands::save_runtime_preferences,
            commands::save_provider_key,
            commands::remove_provider_key,
            commands::provider_status,
            commands::test_provider,
            commands::transcribe_lecture,
            commands::translate_lecture,
            commands::generate_notes,
            commands::generate_review,
            commands::resume_review,
            commands::local_text_models,
            commands::download_text_model,
            commands::remove_text_model,
            commands::ask_lecture,
            commands::job_status,
            commands::cancel_job,
            commands::export_lecture,
            commands::open_data_folder,
            commands::storage_usage,
            commands::quit_app
        ])
        .run(tauri::generate_context!());
    if result.is_err() {
        // Startup failures may happen before the webview exists. Use a native,
        // sanitized message instead of a panic or invisible console output.
        use windows::{
            Win32::UI::WindowsAndMessaging::{MB_ICONERROR, MB_OK, MessageBoxW},
            core::w,
        };
        unsafe {
            MessageBoxW(
                None,
                w!(
                    "LectureRelay 无法启动。请检查应用数据与文档目录权限、WebView2 Runtime，并确认应用是否已在运行。已有课堂资料会保留。"
                ),
                w!("LectureRelay"),
                MB_OK | MB_ICONERROR,
            );
        }
    }
}
