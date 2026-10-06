use super::*;
use std::sync::{Arc, Barrier, Mutex};

fn state(f: &Fixture) -> crate::AppState {
    crate::AppState {
        audio_preview: Default::default(),
        performance: crate::speech::local::performance::Performance::new(true).unwrap(),
        storage: Arc::new(f.db()),
        paths: f.paths.clone(),
        recorder: Default::default(),
        jobs: Default::default(),
        live: Default::default(),
        summaries: Default::default(),
        models: Default::default(),
        runtime: f.root.clone(),
        gate: Mutex::new(()),
        recovered_count: 0,
        _instance_lock: f.paths.acquire_instance_lock().unwrap(),
    }
}

#[test]
fn repeated_stop_preserves_saved_lecture_and_does_not_finalize_other_work() {
    let f = Fixture::new();
    let state = state(&f);
    let c = f.course(&state.storage);
    let lecture = state
        .storage
        .create_lecture(&f.paths, &c.id, "Saved class")
        .unwrap();
    state
        .storage
        .finish_lecture(&lecture.id, 7.95, LectureStatus::Completed)
        .unwrap();
    let before = serde_json::to_value(state.storage.lecture(&lecture.id).unwrap()).unwrap();
    let stopped = crate::commands::stop_recording(&state, &lecture.id).unwrap();
    assert_eq!(serde_json::to_value(stopped).unwrap(), before);
    assert_eq!(
        serde_json::to_value(state.storage.lecture(&lecture.id).unwrap()).unwrap(),
        before
    );
    let unfinished = state
        .storage
        .create_lecture(&f.paths, &c.id, "Needs startup recovery")
        .unwrap();
    assert!(crate::commands::stop_recording(&state, &unfinished.id).is_err());
    assert_eq!(
        state.storage.lecture(&unfinished.id).unwrap().status,
        LectureStatus::Recording
    );
}

#[test]
fn concurrent_atomic_writers_do_not_share_temporary_files() {
    let f = Fixture::new();
    let barrier = Arc::new(Barrier::new(8));
    std::thread::scope(|scope| {
        for index in 0..8 {
            let barrier = barrier.clone();
            let dir = f.paths.library.join("Exports");
            scope.spawn(move || {
                // Same stem but different extensions also used to share a .pending file.
                let path = dir.join(format!("note.{index}"));
                barrier.wait();
                for round in 0..12 {
                    let bytes = format!("{index}:{round}\n").repeat(1024);
                    crate::storage::write_atomic(&path, bytes.as_bytes()).unwrap();
                    assert_eq!(std::fs::read(&path).unwrap(), bytes.as_bytes());
                }
            });
        }
    });
    assert_eq!(
        std::fs::read_dir(f.paths.library.join("Exports"))
            .unwrap()
            .count(),
        8
    );
}

#[test]
fn failed_atomic_replace_cleans_only_its_temporary_file() {
    let f = Fixture::new();
    let target = f.paths.library.join("Exports/blocked.md");
    std::fs::create_dir(&target).unwrap();
    std::fs::write(target.join("keep.txt"), b"preserve").unwrap();
    assert!(crate::storage::write_atomic(&target, b"new").is_err());
    assert_eq!(std::fs::read(target.join("keep.txt")).unwrap(), b"preserve");
    assert_eq!(
        std::fs::read_dir(target.parent().unwrap()).unwrap().count(),
        1
    );
}

#[test]
fn pdf_reads_reject_invalid_and_oversized_files_before_loading_them() {
    let f = Fixture::new();
    let path = f.root.join("fixture.pdf");
    std::fs::write(&path, b"%PDF-1.7\nfixture").unwrap();
    assert_eq!(
        crate::app::media::read_pdf(&path).unwrap(),
        b"%PDF-1.7\nfixture"
    );
    std::fs::write(&path, b"not a PDF").unwrap();
    assert!(crate::app::media::read_pdf(&path).is_err());
    std::fs::File::create(&path)
        .unwrap()
        .set_len(50 * 1024 * 1024 + 1)
        .unwrap();
    assert!(
        crate::app::media::read_pdf(&path)
            .unwrap_err()
            .contains("50 MiB")
    );
}

#[test]
fn committed_import_survives_a_database_finalization_failure() {
    let f = Fixture::new();
    let state = state(&f);
    let c = f.course(&state.storage);
    let source = f.root.join("source.wav");
    let mut writer = hound::WavWriter::create(
        &source,
        hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .unwrap();
    for _ in 0..16000 {
        writer.write_sample(123_i16).unwrap();
    }
    writer.finalize().unwrap();
    let db = rusqlite::Connection::open(f.paths.data.join("app.db")).unwrap();
    db.execute_batch("CREATE TRIGGER fail_import_finish BEFORE UPDATE OF status ON lectures WHEN NEW.status='completed' BEGIN SELECT RAISE(FAIL,'fixture'); END;").unwrap();
    assert!(crate::app::media::import(&state, &c.id, "Import persistence fault", &source).is_err());
    let lecture = state.storage.lectures(&c.id).unwrap().remove(0);
    assert_eq!(lecture.status, LectureStatus::Recording);
    assert!(f.paths.recording(&c.id, &lecture.id).unwrap().is_file());
    db.execute_batch("DROP TRIGGER fail_import_finish;")
        .unwrap();
    assert_eq!(state.storage.recover(&f.paths).unwrap(), 1);
    assert_eq!(
        state.storage.lecture(&lecture.id).unwrap().duration_seconds,
        1.
    );
    assert_eq!(
        state.storage.lecture(&lecture.id).unwrap().audio_source,
        LectureSource::Import
    );
    assert_eq!(hound::WavReader::open(source).unwrap().duration(), 16000);
}

#[test]
fn saved_audio_warning_is_bounded_and_survives_reopening() {
    let f = Fixture::new();
    let recording = f.root.join("recording.wav");
    assert!(crate::audio::saved_warning(&recording).is_none());
    let quality = f.root.join("recording-quality.json");
    std::fs::write(
        &quality,
        br#"{"warning":"Audio device reported a discontinuity."}"#,
    )
    .unwrap();
    assert_eq!(
        crate::audio::saved_warning(&recording).as_deref(),
        Some("Audio device reported a discontinuity.")
    );
    std::fs::write(&quality, b"invalid").unwrap();
    assert!(crate::audio::saved_warning(&recording).is_none());
    std::fs::File::create(&quality)
        .unwrap()
        .set_len(16385)
        .unwrap();
    assert!(crate::audio::saved_warning(&recording).is_none());
}
