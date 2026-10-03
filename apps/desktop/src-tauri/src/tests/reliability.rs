use super::*;
use crate::database::review::{ReviewCheckpoint, ReviewPart};
use crate::storage::cleanup;

fn lecture(f: &Fixture, db: &Storage) -> (Course, Lecture) {
    let c = f.course(db);
    let l = db
        .create_lecture(&f.paths, &c.id, "[ACCEPTANCE] Reliability fixture")
        .unwrap();
    db.finish_lecture(&l.id, 7.95, "completed").unwrap();
    (c, l)
}
fn checkpoint(id: &str) -> ReviewCheckpoint {
    ReviewCheckpoint {
        id: new_id(),
        lecture_id: id.into(),
        fingerprint: "stable".into(),
        request: "review".into(),
        source_version: "source".into(),
        language: "zh".into(),
        origin: "local".into(),
        parts: vec![ReviewPart {
            source: "[00:00] Evidence".into(),
            depth: 0,
            body: Some("Complete source notes".into()),
        }],
        levels: vec![vec!["Complete overview".into()]],
        recoveries: 1,
        state: "paused".into(),
        message: "Cancelled".into(),
        published_version: None,
    }
}
#[test]
fn fractional_times_roundtrip_and_invalid_bounds_are_rejected() {
    let f = Fixture::new();
    let db = f.db();
    let (_, l) = lecture(&f, &db);
    let input = |start, end| SegmentInput {
        start_seconds: start,
        end_seconds: end,
        source_text: "Fractional source".into(),
        translated_text: String::new(),
    };
    db.save_segment(&l.id, None, input(0., 7.95)).unwrap();
    let s = db.segments(&l.id).unwrap().remove(0);
    db.save_segment(&l.id, Some(s.id.clone()), input(0.001234, 7.94987))
        .unwrap();
    let s = db.segments(&l.id).unwrap().remove(0);
    assert_eq!(s.start_seconds, 0.001234);
    assert_eq!(s.end_seconds, 7.94987);
    for (start, end) in [
        (0., 7.951),
        (-0.01, 1.),
        (5., 4.),
        (f64::NAN, 1.),
        (0., f64::INFINITY),
    ] {
        assert!(db.save_segment(&l.id, None, input(start, end)).is_err());
    }
    db.finish_lecture(&l.id, 0.037, "completed").unwrap();
    db.save_segment(&l.id, Some(s.id), input(0., 0.037))
        .unwrap();
}

#[test]
fn stale_review_rejects_transcript_context_language_and_model_changes() {
    use std::sync::{Arc, Mutex};
    let f = Fixture::new();
    let state = crate::AppState {
        audio_preview: Default::default(),
        performance: crate::speech::local::performance::Performance::new(true).unwrap(),
        storage: Arc::new(f.db()),
        paths: f.paths.clone(),
        recorder: Default::default(),
        jobs: Default::default(),
        live: Default::default(),
        models: Default::default(),
        runtime: f.root.clone(),
        gate: Mutex::new(()),
        recovered_count: 0,
        _instance_lock: f.paths.acquire_instance_lock().unwrap(),
    };
    let (c, l) = lecture(&f, &state.storage);
    let input = |text: &str| SegmentInput {
        start_seconds: 0.,
        end_seconds: 7.95,
        source_text: text.into(),
        translated_text: String::new(),
    };
    state
        .storage
        .save_segment(&l.id, None, input("There are 120 students, not 12."))
        .unwrap();
    let fingerprint =
        |request: &str| crate::app::review::fingerprint(&state, &l.id, request).unwrap();
    let before = fingerprint("review");
    assert_ne!(before, fingerprint("another focus"));
    let mut settings = state.storage.settings().unwrap();
    settings.quiet_mode = false;
    state.storage.save_settings(settings.clone()).unwrap();
    assert_eq!(before, fingerprint("review"));
    state
        .storage
        .save_term(&c.id, None, "mitochondria", "线粒体")
        .unwrap();
    assert_ne!(before, fingerprint("review"));
    let context = fingerprint("review");
    settings.study_mode = "cloud".into();
    state.storage.save_settings(settings).unwrap();
    assert_ne!(context, fingerprint("review"));
    let model = fingerprint("review");
    state
        .storage
        .save_course(
            Some(c.id.clone()),
            CourseInput {
                name: c.name,
                code: c.code,
                subject: c.subject,
                description: c.description,
                assistance_language: "ja".into(),
            },
        )
        .unwrap();
    assert_ne!(model, fingerprint("review"));
    let mut review = checkpoint(&l.id);
    review.fingerprint = fingerprint(&review.request);
    state.storage.save_review_checkpoint(&review).unwrap();
    let segment = state.storage.segments(&l.id).unwrap().remove(0);
    state
        .storage
        .save_segment(
            &l.id,
            Some(segment.id),
            input("There are 121 students, not 12."),
        )
        .unwrap();
    assert!(
        tauri::async_runtime::block_on(crate::app::review::run(
            &state,
            &l.id,
            "",
            Some(&review.id)
        ))
        .unwrap_err()
        .contains("changed")
    );
    let saved = state.storage.review_checkpoint(&l.id, &review.id).unwrap();
    assert_eq!(saved.state, "stale");
    assert_eq!(saved.parts[0].body, review.parts[0].body);
    assert!(
        state
            .storage
            .study_state(&l.id)
            .unwrap()
            .versions
            .is_empty()
    );
}
#[test]
fn persisted_review_publication_is_idempotent_and_preserves_manual_work() {
    let f = Fixture::new();
    let db = f.db();
    let (_, l) = lecture(&f, &db);
    db.save_note(&l.id, "Keep manual notes", "manual").unwrap();
    db.save_draft(&l.id, "Keep draft").unwrap();
    db.add_note_version(&l.id, "Keep old version", "local", "zh", "old")
        .unwrap();
    let review = checkpoint(&l.id);
    db.save_review_checkpoint(&review).unwrap();
    drop(db);
    let db = f.db();
    let mut resumed = db.review_checkpoint(&l.id, &review.id).unwrap();
    assert_eq!(resumed.parts[0].body, review.parts[0].body);
    db.publish_review(&mut resumed, "All sections").unwrap();
    let version = resumed.published_version.clone();
    let mut old = review.clone();
    db.publish_review(&mut old, "Duplicate must not save")
        .unwrap();
    assert_eq!(old.published_version, version);
    let s = db.study_state(&l.id).unwrap();
    assert_eq!(s.versions.len(), 2);
    assert!(s.versions.iter().any(|v| v.body == "Keep old version"));
    assert_eq!(s.draft.as_deref(), Some("Keep draft"));
    assert_eq!(db.note(&l.id).unwrap().unwrap().body, "Keep manual notes");
}
#[test]
fn permanent_delete_and_free_storage_remove_only_confirmed_app_content() {
    let f = Fixture::new();
    let db = f.db();
    let (c, l) = lecture(&f, &db);
    let (other, keep) = lecture(&f, &db);
    db.save_draft(&l.id, "draft").unwrap();
    db.save_review_checkpoint(&checkpoint(&l.id)).unwrap();
    db.add_note_version(&l.id, "version", "local", "zh", "v")
        .unwrap();
    db.create_task(&l.id, "notes").unwrap();
    db.save_mark(&l.id, 1., "mark", "bookmark").unwrap();
    db.pin_lecture(&l.id, true).unwrap();
    let source = f.root.join("source.wav");
    std::fs::write(&source, b"original").unwrap();
    std::fs::write(f.paths.recording(&c.id, &l.id).unwrap(), b"owned copy").unwrap();
    let export = f
        .paths
        .library
        .join("Exports")
        .join(format!("{}-notes-123.md", l.id));
    std::fs::write(&export, b"export").unwrap();
    let model = f.paths.data.join("models/test.gguf");
    std::fs::write(&model, b"owned model").unwrap();
    assert!(cleanup::run(&f.paths, &db, Some(&c.id)).is_err());
    db.delete_course(&c.id).unwrap();
    assert_eq!(
        cleanup::run(&f.paths, &db, Some(&c.id)).unwrap(),
        vec![l.id.clone()]
    );
    assert!(db.lecture(&l.id).is_err());
    assert!(!export.exists());
    assert!(model.exists());
    assert!(source.exists());
    assert!(db.lecture(&keep.id).is_ok());
    assert!(db.review_checkpoint(&l.id, &checkpoint(&l.id).id).is_err());
    let settings = db.settings().unwrap();
    cleanup::run(&f.paths, &db, None).unwrap();
    assert!(db.courses().unwrap().is_empty());
    assert!(db.trash().unwrap().is_empty());
    assert!(db.course(&other.id).is_err());
    assert!(!model.exists());
    assert!(source.exists());
    assert_eq!(db.settings().unwrap().theme, settings.theme);
    assert_eq!(
        std::fs::read_dir(f.paths.library.join("Courses"))
            .unwrap()
            .count(),
        0
    );
    assert!(f.paths.data.join("state").is_dir());
    assert_eq!(f.db().courses().unwrap().len(), 0);
}
#[test]
fn migration_preserves_translation_history_and_only_corrects_known_local_origins() {
    let f = Fixture::new();
    let path = f.paths.data.join("app.db");
    let old = rusqlite::Connection::open(&path).unwrap();
    old.execute_batch(include_str!("../database/migrations/001_initial.sql"))
        .unwrap();
    old.execute_batch(include_str!("../database/migrations/002_classroom.sql"))
        .unwrap();
    old.execute_batch(include_str!(
        "../database/migrations/003_study_workspace.sql"
    ))
    .unwrap();
    old.execute_batch("PRAGMA user_version=3; INSERT INTO courses(id,name,subject,assistance_language,created_at) VALUES('c','c','subject','zh',1); INSERT INTO lectures(id,course_id,title,started_at,status,recording_path) VALUES('l','c','l',1,'completed','unused'); INSERT INTO transcript_segments(id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin,provider) VALUES('local','l',0,1,'text','translation','cloud','local'),('unknown','l',1,2,'text','','cloud','legacy'),('manual','l',2,3,'edited','','manual','local');").unwrap();
    drop(old);
    let db = f.db();
    let segments = db.segments("l").unwrap();
    assert_eq!(segments[0].origin, "local");
    assert_eq!(segments[1].origin, "cloud");
    assert_eq!(segments[2].origin, "manual");
    let check = rusqlite::Connection::open(path).unwrap();
    assert_eq!(
        check
            .query_row::<i64, _, _>("SELECT COUNT(*) FROM translation_versions", [], |r| r
                .get(0))
            .unwrap(),
        1
    );
    assert_eq!(
        check
            .query_row::<i64, _, _>("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| r
                .get(0))
            .unwrap(),
        0
    );
    assert_eq!(
        serde_json::to_value(&segments[0]).unwrap()["origin"],
        "local"
    );
}

#[test]
fn old_failed_imports_are_repaired_only_with_recorded_import_evidence() {
    let f = Fixture::new();
    let db = f.db();
    let (_, imported) = lecture(&f, &db);
    let (_, capture) = lecture(&f, &db);
    db.create_task(&imported.id, "import").unwrap();
    db.finish_lecture(&imported.id, 0., "failed").unwrap();
    db.finish_lecture(&capture.id, 0., "failed").unwrap();
    drop(db);
    let db = f.db();
    assert_eq!(db.lecture(&imported.id).unwrap().audio_source, "import");
    assert_eq!(db.lecture(&capture.id).unwrap().audio_source, "microphone");
}

#[test]
#[ignore = "creates a fresh explicitly selected isolated reliability UI library"]
fn prepare_reliability_ui_fixture() {
    let requested = std::path::PathBuf::from(
        std::env::var_os("LECTURERELAY_TEST_ROOT").expect("explicit test root"),
    );
    let allowed = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../target")
        .canonicalize()
        .unwrap();
    assert!(
        requested.is_absolute()
            && requested.parent().unwrap().canonicalize().unwrap() == allowed
            && requested
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("reliability-ui-")
            && !requested.exists()
    );
    let paths = AppPaths::production().unwrap();
    let db = Storage::open(&paths.data.join("app.db")).unwrap();
    db.save_settings(AppSettings {
        speech_provider: "none".into(),
        translation_mode: "none".into(),
        study_mode: "none".into(),
        audio_source: "system".into(),
        ..Default::default()
    })
    .unwrap();
    let mut ids = Vec::new();
    for (name, duration) in [("Delete fixture", 7.95), ("Keep fixture", 7.95)] {
        let course = db
            .save_course(
                None,
                CourseInput {
                    name: format!("[ACCEPTANCE 2026-10-03] {name}"),
                    code: "TEST".into(),
                    subject: "Computer Science".into(),
                    description: "Non-sensitive disposable fixture".into(),
                    assistance_language: "zh".into(),
                },
            )
            .unwrap();
        let l = db
            .create_lecture(&paths, &course.id, &format!("[ACCEPTANCE] {name}"))
            .unwrap();
        let mut wav = hound::WavWriter::create(
            paths.recording(&course.id, &l.id).unwrap(),
            hound::WavSpec {
                channels: 1,
                sample_rate: 16000,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            },
        )
        .unwrap();
        for _ in 0..(duration * 16000.) as usize {
            wav.write_sample(0i16).unwrap();
        }
        wav.finalize().unwrap();
        db.finish_lecture(&l.id, duration, "completed").unwrap();
        db.save_note(&l.id, "Keep manual notes", "manual").unwrap();
        if name == "Delete fixture" {
            db.save_review_checkpoint(&checkpoint(&l.id)).unwrap();
            db.delete_course(&course.id).unwrap();
        }
        ids.push(serde_json::json!({"courseId":course.id,"lectureId":l.id,"name":course.name,"title":l.title}));
    }
    std::fs::write(
        paths.data.join("models/cleanup-fixture.bin"),
        vec![1u8; 4096],
    )
    .unwrap();
    std::fs::write(
        paths.library.join("Exports/fixture.txt"),
        b"Disposable in-app export",
    )
    .unwrap();
    std::fs::write(
        requested.join("fixture.json"),
        serde_json::to_vec_pretty(&ids).unwrap(),
    )
    .unwrap();
}
