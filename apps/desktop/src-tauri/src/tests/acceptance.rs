use super::*;

#[test]
fn model_download_announces_connection_and_allows_cancellation_before_network() {
    use std::sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    };
    use std::time::Duration;
    let fixture = Fixture::new();
    let state = Arc::new(crate::AppState {
        audio_preview: Default::default(),
        performance: crate::speech::local::performance::Performance::new(true).unwrap(),
        storage: Arc::new(fixture.db()),
        paths: fixture.paths.clone(),
        recorder: Default::default(),
        jobs: Default::default(),
        live: Default::default(),
        summaries: Default::default(),
        models: Default::default(),
        runtime: fixture.root.join("unused-runtime"),
        gate: Mutex::new(()),
        recovered_count: 0,
        _instance_lock: fixture.paths.acquire_instance_lock().unwrap(),
    });
    let server = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/model", server.local_addr().unwrap());
    server.set_nonblocking(true).unwrap();
    let done = Arc::new(AtomicBool::new(false));
    let server_done = done.clone();
    let server_thread = std::thread::spawn(move || {
        let mut connections = Vec::new();
        while !server_done.load(Ordering::Relaxed) {
            if let Ok((stream, _)) = server.accept() {
                connections.push(stream);
            }
            // Deliberately withhold response headers; cancellation must not wait for data.
            std::thread::sleep(Duration::from_millis(5));
        }
        connections.len()
    });
    let fallback = state.clone();
    let watchdog = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(250));
        fallback.models.cancel.store(true, Ordering::Relaxed);
    });
    let events = Mutex::new(Vec::new());
    let result = tauri::async_runtime::block_on(async {
        tokio::time::timeout(
            Duration::from_secs(2),
            crate::models::manager::download_model_from(
                &state,
                crate::models::manager::MODEL_ID,
                &url,
                |status| {
                    events
                        .lock()
                        .unwrap()
                        .push((status.downloading, status.downloaded_bytes));
                    if status.downloading {
                        state.models.cancel.store(true, Ordering::Relaxed);
                    }
                },
            ),
        )
        .await
    });
    done.store(true, Ordering::Relaxed);
    let connections = server_thread.join().unwrap();
    watchdog.join().unwrap();
    assert_eq!(result.unwrap().unwrap_err(), "Model download cancelled.");
    assert_eq!(*events.lock().unwrap(), vec![(true, 0), (false, 0)]);
    assert_eq!(
        connections, 0,
        "Cancellation from the initial event avoids even opening the network request"
    );
    assert!(!crate::models::manager::downloading(&state).unwrap());
    assert!(
        !crate::models::manager::path(&state)
            .with_extension("part")
            .exists()
    );
}

#[test]
#[ignore = "prepares a fresh debug-only UI fixture with pinned downloaded text models"]
fn prepare_local_ai_ui_fixture() {
    prepare_isolated_native_ui_fixture();
    let paths = AppPaths::production().unwrap();
    let db = Storage::open(&paths.data.join("app.db")).unwrap();
    db.save_settings(AppSettings {
        quiet_mode: false,
        ..Default::default()
    })
    .unwrap();
    for id in [
        crate::models::catalog::TRANSLATION,
        crate::models::catalog::STUDY,
    ] {
        let model = crate::models::catalog::get(id).unwrap();
        let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/local-ai-evaluation/models")
            .join(model.file);
        std::fs::hard_link(source, paths.data.join("models").join(model.file)).unwrap();
        let manifest = serde_json::json!({"id":id,"revision":model.revision,"sha256":model.sha256,"runtimeVersion":model.runtime});
        std::fs::write(
            paths.data.join(format!("models/{id}.json")),
            manifest.to_string(),
        )
        .unwrap();
        db.install_model(id, model.revision, model.sha256, model.size)
            .unwrap();
    }
}

#[test]
#[ignore = "downloads the official 667 MiB model twice to verify cancellation, install and removal"]
fn official_model_download_cancel_install_and_remove() {
    use std::sync::{Arc, Mutex, atomic::Ordering};
    let fixture = Fixture::new();
    let state = Arc::new(crate::AppState {
        audio_preview: Default::default(),
        performance: crate::speech::local::performance::Performance::new(true).unwrap(),
        storage: Arc::new(fixture.db()),
        paths: fixture.paths.clone(),
        recorder: Default::default(),
        jobs: Default::default(),
        live: Default::default(),
        summaries: Default::default(),
        models: Default::default(),
        runtime: std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/local-asr"),
        gate: Mutex::new(()),
        recovered_count: 0,
        _instance_lock: fixture.paths.acquire_instance_lock().unwrap(),
    });
    let cancelled =
        tauri::async_runtime::block_on(crate::models::manager::download_with(&state, |value| {
            if value.downloading && value.downloaded_bytes > 0 {
                state.models.cancel.store(true, Ordering::Relaxed);
            }
        }));
    assert_eq!(cancelled.unwrap_err(), "Model download cancelled.");
    assert!(!crate::models::manager::status(&state).unwrap().installed);
    assert!(
        !crate::models::manager::path(&state)
            .with_extension("part")
            .exists()
    );
    tauri::async_runtime::block_on(crate::models::manager::download_with(&state, |_| {})).unwrap();
    assert!(crate::models::manager::status(&state).unwrap().installed);
    assert!(
        state
            .paths
            .data
            .join("models/NVIDIA-Open-Model-License.pdf")
            .is_file()
    );
    assert!(state.paths.data.join("models/NOTICE.txt").is_file());
    let mut engine = crate::speech::local::worker::LocalSpeech::open(
        &state.runtime,
        &crate::models::manager::path(&state),
        &state.performance,
    )
    .unwrap();
    assert!(
        engine
            .transcribe(&vec![0; 16000], 16000)
            .unwrap()
            .trim()
            .is_empty()
    );
    drop(engine);
    crate::models::manager::remove(&state).unwrap();
    assert!(!crate::models::manager::status(&state).unwrap().installed);
    drop(state);
}

#[test]
#[ignore = "creates deterministic data only in an explicitly selected isolated UI test directory"]
fn prepare_isolated_native_ui_fixture() {
    let root = std::env::var_os("LECTURERELAY_TEST_ROOT").expect("test root required");
    let root = std::path::PathBuf::from(root);
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../target")
        .canonicalize()
        .unwrap();
    std::fs::create_dir_all(&root).unwrap();
    assert!(root.canonicalize().unwrap().starts_with(workspace));
    let paths = AppPaths::production().unwrap();
    let db = Storage::open(&paths.data.join("app.db")).unwrap();
    assert!(
        db.courses().unwrap().is_empty(),
        "use a fresh test directory"
    );
    let course = db
        .save_course(
            None,
            CourseInput {
                name: "[TEST] Biology — synthetic fixture".into(),
                code: "BIO101".into(),
                subject: "Biology / Medicine".into(),
                description: "Isolated verification data; no real lecture content.".into(),
                assistance_language: "zh".into(),
            },
        )
        .unwrap();
    db.save_term(&course.id, None, "mitochondria", "线粒体")
        .unwrap();
    let lecture = db
        .create_lecture(
            &paths,
            &course.id,
            "[TEST] Audio playback and bilingual timeline",
        )
        .unwrap();
    let mut wav = hound::WavWriter::create(
        paths.recording(&course.id, &lecture.id).unwrap(),
        hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .unwrap();
    for sample in 0..16000 * 12 {
        let tone = ((sample as f32 * 220.0 * std::f32::consts::TAU / 16000.0).sin() * 300.0) as i16;
        wav.write_sample(tone).unwrap();
    }
    wav.finalize().unwrap();
    db.finish_lecture(&lecture.id, 12.0, LectureStatus::Completed)
        .unwrap();
    for (start, end, source, translation) in [
        (1.0, 3.0, "Mitochondria generate ATP.", "线粒体产生 ATP。"),
        (
            6.0,
            9.0,
            "Review cellular respiration before Friday.",
            "请在星期五前复习细胞呼吸。",
        ),
    ] {
        db.save_segment(
            &lecture.id,
            None,
            SegmentInput {
                start_seconds: start,
                end_seconds: end,
                source_text: source.into(),
                translated_text: translation.into(),
            },
        )
        .unwrap();
    }
    db.save_note(&lecture.id, "# 测试笔记\n\n## 关键术语\n- mitochondria：线粒体\n\n## 复习\n星期五前复习细胞呼吸。[00:06]\n\n*手工测试资料；未调用 AI。*", "manual").unwrap();
    db.snapshot(&paths, &lecture.id).unwrap();
}
