mod acceptance;
mod local_ai;
mod reliability;
mod study_workspace;

#[test]
fn runtime_preferences_upgrade_and_persist() {
    let legacy: crate::domain::AppSettings =
        serde_json::from_str(r#"{"assistanceLanguage":"ja"}"#).unwrap();
    assert_eq!(legacy.theme, "light");
    assert!(legacy.quiet_mode);
    let fixture = Fixture::new();
    let db = fixture.db();
    let settings = crate::domain::AppSettings {
        theme: "dark".into(),
        quiet_mode: false,
        ..legacy
    };
    db.save_settings(settings.clone()).unwrap();
    drop(db);
    let db = fixture.db();
    assert_eq!(db.settings().unwrap().theme, "dark");
    assert!(!db.settings().unwrap().quiet_mode);
    assert_eq!(db.settings().unwrap().assistance_language, "ja");
    assert!(
        db.save_settings(crate::domain::AppSettings {
            theme: "invalid".into(),
            ..settings
        })
        .is_err()
    );
    assert_eq!(db.settings().unwrap().theme, "dark");
}

use crate::{database::Storage, domain::*, storage::AppPaths};

struct Fixture {
    root: std::path::PathBuf,
    paths: AppPaths,
}
impl Fixture {
    fn new() -> Self {
        let workspace =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../target/test-fixtures");
        let root = workspace.join(new_id());
        let paths = AppPaths::initialize(root.join("state"), root.join("library")).unwrap();
        Self { root, paths }
    }
    fn db(&self) -> Storage {
        Storage::open(&self.paths.data.join("app.db")).unwrap()
    }
    fn course(&self, db: &Storage) -> Course {
        db.save_course(
            None,
            CourseInput {
                name: "Introduction to Biology".into(),
                code: "BIO101".into(),
                subject: "Biology / Medicine".into(),
                description: "Genetics and cell biology".into(),
                assistance_language: "zh".into(),
            },
        )
        .unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[test]
fn migrations_reopen_and_preserve_full_learning_data() {
    let fixture = Fixture::new();
    let db = fixture.db();
    let course = fixture.course(&db);
    db.save_term(&course.id, None, "mitochondria", "线粒体")
        .unwrap();
    let lecture = db
        .create_lecture(&fixture.paths, &course.id, "Genetics lecture")
        .unwrap();
    db.finish_lecture(&lecture.id, 120.0, "completed").unwrap();
    db.save_segment(
        &lecture.id,
        None,
        SegmentInput {
            start_seconds: 30.0,
            end_seconds: 45.0,
            source_text: "Mitochondria generate ATP.".into(),
            translated_text: "线粒体产生 ATP。".into(),
        },
    )
    .unwrap();
    db.save_note(&lecture.id, "# 学习笔记\n\n中文 日本語 한국어", "manual")
        .unwrap();
    let answer = Answer {
        id: new_id(),
        question: "What produces ATP?".into(),
        answer: "Mitochondria [S1]".into(),
        sources: db.segments(&lecture.id).unwrap(),
        created_at: now(),
    };
    db.save_answer(&lecture.id, &answer).unwrap();
    db.save_settings(AppSettings {
        assistance_language: "ko".into(),
        provider: "none".into(),
        chat_model: "gpt-4o-mini".into(),
        ..Default::default()
    })
    .unwrap();
    db.snapshot(&fixture.paths, &lecture.id).unwrap();
    drop(db);
    let reopened = fixture.db();
    assert_eq!(reopened.course(&course.id).unwrap().lecture_count, 1);
    let detail = reopened.detail(&lecture.id).unwrap();
    assert_eq!(detail.segments[0].start_seconds, 30.0);
    assert_eq!(
        detail.note.unwrap().body,
        "# 学习笔记\n\n中文 日本語 한국어"
    );
    assert_eq!(detail.answers[0].sources[0].id, detail.segments[0].id);
    assert_eq!(
        reopened.glossary(&course.id).unwrap()[0].translation,
        "线粒体"
    );
    assert_eq!(reopened.settings().unwrap().assistance_language, "ko");
    let connection = rusqlite::Connection::open(fixture.paths.data.join("app.db")).unwrap();
    assert_eq!(
        connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i32>(0))
            .unwrap(),
        4
    );
    let preferences: String = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key='preferences'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert!(!preferences.contains("apiKey"));
    assert!(!preferences.contains("Bearer"));
}

#[test]
fn data_root_is_exclusive_and_reopens_after_process_lock_release() {
    let fixture = Fixture::new();
    let lock = fixture.paths.acquire_instance_lock().unwrap();
    assert!(fixture.paths.acquire_instance_lock().is_err());
    drop(lock);
    let _reopened = fixture.paths.acquire_instance_lock().unwrap();
}

#[test]
fn upgrades_real_v1_schema_and_old_preferences_without_changing_content() {
    let fixture = Fixture::new();
    let old = rusqlite::Connection::open(fixture.paths.data.join("app.db")).unwrap();
    old.execute_batch(include_str!("../database/migrations/001_initial.sql"))
        .unwrap();
    old.execute_batch("PRAGMA user_version=1;").unwrap();
    let course = new_id();
    let lecture = new_id();
    let segment = new_id();
    old.execute("INSERT INTO courses(id,name,code,subject,description,assistance_language,created_at) VALUES(?1,'Biology','BIO','Biology','Legacy','zh',1)",[&course]).unwrap();
    old.execute("INSERT INTO lectures(id,course_id,title,started_at,status,duration_seconds,recording_path) VALUES(?1,?2,'Legacy lecture',1,'completed',60,'recording.wav')",rusqlite::params![lecture,course]).unwrap();
    old.execute("INSERT INTO transcript_segments(id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin) VALUES(?1,?2,1,5,'Original English','原来的中文','cloud')",rusqlite::params![segment,lecture]).unwrap();
    old.execute(
        "INSERT INTO app_settings(key,value) VALUES('preferences',?1)",
        [r#"{"assistanceLanguage":"ja","provider":"none","chatModel":"gpt-4o-mini"}"#],
    )
    .unwrap();
    drop(old);
    let upgraded = fixture.db();
    let detail = upgraded.detail(&lecture).unwrap();
    assert_eq!(detail.segments[0].source_text, "Original English");
    assert_eq!(detail.segments[0].translated_text, "原来的中文");
    assert_eq!(detail.segments[0].provider, "legacy");
    assert_eq!(upgraded.settings().unwrap().assistance_language, "ja");
    assert_eq!(upgraded.settings().unwrap().speech_provider, "none");
    upgraded
        .save_segment(
            &lecture,
            Some(segment.clone()),
            SegmentInput {
                start_seconds: 1.,
                end_seconds: 5.,
                source_text: "Corrected English".into(),
                translated_text: "原来的中文".into(),
            },
        )
        .unwrap();
    let db = rusqlite::Connection::open(fixture.paths.data.join("app.db")).unwrap();
    let original: String = db
        .query_row(
            "SELECT source_text FROM transcript_edits WHERE segment_id=?1",
            [segment],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(original, "Original English");
}

#[test]
fn interruption_recovers_checkpointed_wav_and_cleans_recovery_marker() {
    let fixture = Fixture::new();
    let db = fixture.db();
    let course = fixture.course(&db);
    let lecture = db
        .create_lecture(&fixture.paths, &course.id, "Interrupted classroom")
        .unwrap();
    let path = fixture.paths.recording(&course.id, &lecture.id).unwrap();
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(&path, spec).unwrap();
    for _ in 0..32000 {
        writer.write_sample(200_i16).unwrap();
    }
    writer.flush().unwrap();
    // Verify recovery while the writer is still open: only the checkpointed
    // header is available, just as it is after abrupt process termination.
    let marker = fixture
        .paths
        .data
        .join("recovery")
        .join(format!("{}.json", lecture.id));
    std::fs::write(&marker, b"{}").unwrap();
    assert_eq!(db.recover(&fixture.paths).unwrap(), 1);
    let recovered = db.lecture(&lecture.id).unwrap();
    assert_eq!(recovered.status, "interrupted");
    assert_eq!(recovered.duration_seconds, 2.0);
    assert!(!marker.exists());
    writer.finalize().unwrap();
    assert_eq!(db.recover(&fixture.paths).unwrap(), 0);
}

#[test]
fn trash_preserves_courses_lectures_and_files_and_can_restore() {
    let fixture = Fixture::new();
    let db = fixture.db();
    let course = fixture.course(&db);
    let lecture = db
        .create_lecture(&fixture.paths, &course.id, "Keep the user's audio")
        .unwrap();
    let path = fixture.paths.recording(&course.id, &lecture.id).unwrap();
    std::fs::write(&path, b"synthetic audio fixture").unwrap();
    db.finish_lecture(&lecture.id, 1.0, "completed").unwrap();
    db.save_note(&lecture.id, "User note", "manual").unwrap();
    db.snapshot(&fixture.paths, &lecture.id).unwrap();
    db.delete_course(&course.id).unwrap();
    assert!(db.courses().unwrap().is_empty());
    assert!(db.lecture(&lecture.id).is_ok());
    assert_eq!(db.trash().unwrap().len(), 1);
    db.restore_course(&course.id).unwrap();
    assert_eq!(
        db.detail(&lecture.id).unwrap().note.unwrap().body,
        "User note"
    );
    assert!(path.exists());
    assert!(path.parent().unwrap().join("notes.md").exists());
}

#[test]
fn rejects_invalid_timeline_language_and_path_traversal() {
    let fixture = Fixture::new();
    let db = fixture.db();
    let course = fixture.course(&db);
    let lecture = db
        .create_lecture(&fixture.paths, &course.id, "Validation")
        .unwrap();
    db.finish_lecture(&lecture.id, 10.0, "completed").unwrap();
    assert!(
        db.save_segment(
            &lecture.id,
            None,
            SegmentInput {
                start_seconds: -1.0,
                end_seconds: 2.0,
                source_text: "hello".into(),
                translated_text: String::new()
            }
        )
        .is_err()
    );
    assert!(
        db.save_segment(
            &lecture.id,
            None,
            SegmentInput {
                start_seconds: 0.0,
                end_seconds: 100.0,
                source_text: "hello".into(),
                translated_text: String::new()
            }
        )
        .is_err()
    );
    assert!(
        db.save_settings(AppSettings {
            assistance_language: "fr".into(),
            ..Default::default()
        })
        .is_err()
    );
    assert!(
        fixture
            .paths
            .recording("../../secrets", &lecture.id)
            .is_err()
    );
    db.save_term(&course.id, None, "ATP", "ATP").unwrap();
    assert!(db.save_term(&course.id, None, "ATP", "duplicate").is_err());
}

#[test]
fn cloud_chunks_commit_progress_without_overwriting_manual_corrections() {
    let fixture = Fixture::new();
    let db = fixture.db();
    let course = fixture.course(&db);
    let lecture = db
        .create_lecture(&fixture.paths, &course.id, "Chunk persistence")
        .unwrap();
    db.finish_lecture(&lecture.id, 120.0, "completed").unwrap();
    let segment = TranscriptSegment {
        id: new_id(),
        lecture_id: lecture.id.clone(),
        start_seconds: 1.0,
        end_seconds: 9.0,
        source_text: "Genetics".into(),
        translated_text: String::new(),
        origin: "cloud".into(),
        provider: "legacy".into(),
        status: "final".into(),
        transcript_version: "original".into(),
        revision: 0,
    };
    db.append_cloud_chunk(&lecture.id, std::slice::from_ref(&segment), 60.0)
        .unwrap();
    db.translate_segment(&lecture.id, &segment.id, "遗传学")
        .unwrap();
    db.translate_segment(&lecture.id, &segment.id, "overwrite attempt")
        .unwrap();
    assert_eq!(
        db.segments(&lecture.id).unwrap()[0].translated_text,
        "遗传学"
    );
    assert_eq!(db.lecture(&lecture.id).unwrap().transcribed_until, 60.0);
}

#[test]
fn atomic_asset_updates_replace_existing_file_without_leftovers() {
    let fixture = Fixture::new();
    let path = fixture.paths.library.join("Exports/note.md");
    crate::storage::write_atomic(&path, b"first").unwrap();
    crate::storage::write_atomic(&path, b"second").unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), b"second");
    assert!(!path.with_extension("pending").exists());
}

#[test]
fn jobs_are_exclusive_cancellable_and_release_on_error() {
    let jobs = crate::app::jobs::Jobs::default();
    let guard = jobs.begin("lecture", "transcription").unwrap();
    assert!(jobs.begin("another", "notes").is_err());
    jobs.cancel();
    assert!(jobs.checkpoint().is_err());
    drop(guard);
    assert!(jobs.status().unwrap().is_none());
    let _guard = jobs.begin("another", "notes").unwrap();
    assert!(jobs.checkpoint().is_ok());
}
