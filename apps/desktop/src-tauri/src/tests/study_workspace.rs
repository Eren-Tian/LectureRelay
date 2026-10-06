use super::*;
use std::sync::Arc;

fn lecture(f: &Fixture, db: &Storage) -> (Course, Lecture) {
    let course = f.course(db);
    let lecture = db
        .create_lecture(&f.paths, &course.id, "Workspace test")
        .unwrap();
    db.finish_lecture(&lecture.id, 60., LectureStatus::Completed)
        .unwrap();
    (course, lecture)
}
fn segment(db: &Storage, id: &str) -> TranscriptSegment {
    db.save_segment(
        id,
        None,
        SegmentInput {
            start_seconds: 1.,
            end_seconds: 5.,
            source_text: "Do not increase the dose above 2 mg.".into(),
            translated_text: String::new(),
        },
    )
    .unwrap();
    db.segments(id).unwrap().remove(0)
}
#[test]
fn late_translation_cannot_cross_source_revision_or_target_language() {
    let f = Fixture::new();
    let db = f.db();
    let (course, l) = lecture(&f, &db);
    let original = segment(&db, &l.id);
    db.save_segment(
        &l.id,
        Some(original.id.clone()),
        SegmentInput {
            start_seconds: 1.,
            end_seconds: 5.,
            source_text: "Keep the dose below 1 mg.".into(),
            translated_text: String::new(),
        },
    )
    .unwrap();
    assert!(!db.translate_checked(&original, "zh", "旧结果").unwrap());
    let revised = db.segments(&l.id).unwrap().remove(0);
    assert_eq!(revised.revision, 1);
    assert!(
        db.translate_checked(&revised, "zh", "保持剂量低于 1 mg。")
            .unwrap()
    );
    assert!(!db.translate_checked(&revised, "zh", "overwrite").unwrap());
    let change = |language: &str| CourseInput {
        name: course.name.clone(),
        code: course.code.clone(),
        subject: course.subject.clone(),
        description: course.description.clone(),
        assistance_language: language.into(),
    };
    db.save_course(Some(course.id.clone()), change("ja"))
        .unwrap();
    assert!(db.segments(&l.id).unwrap()[0].translated_text.is_empty());
    assert!(!db.translate_checked(&revised, "zh", "迟到中文").unwrap());
    assert!(
        db.translate_checked(&revised, "ja", "1 mg 未満に保つ。")
            .unwrap()
    );
    db.save_course(Some(course.id.clone()), change("zh"))
        .unwrap();
    assert_eq!(
        db.segments(&l.id).unwrap()[0].translated_text,
        "保持剂量低于 1 mg。"
    );
}
#[test]
fn persistent_tasks_recover_and_keep_completed_results() {
    let f = Fixture::new();
    let db = Arc::new(f.db());
    let (_, l) = lecture(&f, &db);
    let jobs = crate::app::jobs::Jobs::persistent(db.clone());
    let job = jobs.begin(&l.id, "translation").unwrap();
    jobs.progress(2, 5);
    jobs.cancel();
    job.finish(&Err::<(), _>("cancel".into())).unwrap();
    assert_eq!(db.tasks(&l.id).unwrap()[0].state, "cancelled");
    let job = jobs.begin(&l.id, "notes").unwrap();
    job.finish(&Ok(())).unwrap();
    assert_eq!(db.tasks(&l.id).unwrap()[0].state, "completed");
    let interrupted = db.create_task(&l.id, "transcription").unwrap();
    db.task_progress(&interrupted, 3, 8).unwrap();
    drop(jobs);
    drop(db);
    let db = f.db();
    let tasks = db.tasks(&l.id).unwrap();
    let task = tasks.iter().find(|t| t.id == interrupted).unwrap();
    assert_eq!(task.state, "interrupted");
    assert_eq!(task.completed, 3);
    assert!(tasks.iter().any(|t| t.state == "completed"));
}
#[test]
fn drafts_marks_ai_versions_survive_restart_without_overwriting_notes() {
    let f = Fixture::new();
    let db = f.db();
    let (_, l) = lecture(&f, &db);
    segment(&db, &l.id);
    let source = db.source_version(&l.id).unwrap();
    db.save_note(&l.id, "My own notes", "manual").unwrap();
    db.save_draft(&l.id, "Unsaved keyboard input 中文 日本語 한국어")
        .unwrap();
    db.add_note_version(&l.id, "AI proposal", "cloud", "zh", &source)
        .unwrap();
    db.save_mark(&l.id, 3.0, "Important", "bookmark").unwrap();
    db.save_mark(&l.id, 12., "Second topic", "chapter").unwrap();
    assert!(
        db.save_mark(&l.id, f64::NAN, "invalid", "bookmark")
            .is_err()
    );
    drop(db);
    let db = f.db();
    let state = db.study_state(&l.id).unwrap();
    assert_eq!(db.note(&l.id).unwrap().unwrap().body, "My own notes");
    assert!(state.draft.unwrap().contains("Unsaved keyboard"));
    assert_eq!(state.marks.len(), 2);
    assert_eq!(state.versions[0].body, "AI proposal");
    assert_eq!(state.versions[0].source_version, source);
}
#[test]
fn subtitle_exports_are_ordered_nonoverlapping_and_language_specific() {
    let f = Fixture::new();
    let db = f.db();
    let (_, l) = lecture(&f, &db);
    let mut a = segment(&db, &l.id);
    a.start_seconds = 1.25;
    a.end_seconds = 5.;
    a.translated_text = "字幕".into();
    let mut b = a.clone();
    b.start_seconds = 4.;
    b.end_seconds = 6.;
    b.source_text = "<script> -->".into();
    let srt = crate::app::exports::subtitles(&[b.clone(), a.clone()], false, "bilingual").unwrap();
    assert!(srt.contains("00:00:01,250 --> 00:00:04,000"));
    assert!(!srt.contains("<script>"));
    assert!(srt.contains("字幕"));
    let vtt = crate::app::exports::subtitles(&[a], true, "source").unwrap();
    assert!(vtt.starts_with("WEBVTT"));
    assert!(vtt.contains("00:00:01.250"));
    assert!(!vtt.contains("字幕"));
}
#[test]
fn media_import_decodes_stereo_preserves_source_and_observes_cancellation() {
    let f = Fixture::new();
    let source = f.root.join("synthetic.wav");
    let out = f.root.join("decoded.wav");
    let mut w = hound::WavWriter::create(
        &source,
        hound::WavSpec {
            channels: 2,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .unwrap();
    for _ in 0..32000 {
        w.write_sample(1000i16).unwrap();
        w.write_sample(-500i16).unwrap();
    }
    w.finalize().unwrap();
    let original = std::fs::read(&source).unwrap();
    let duration = crate::app::media::decode(&source, &out, |_, _| Ok(())).unwrap();
    assert_eq!(duration, 2.);
    let r = hound::WavReader::open(&out).unwrap();
    assert_eq!(r.spec().channels, 1);
    assert_eq!(r.duration(), 32000);
    assert_eq!(std::fs::read(&source).unwrap(), original);
    assert!(
        crate::app::media::decode(&source, &f.root.join("cancel.wav"), |_, _| Err(
            "cancelled".into()
        ))
        .is_err()
    );
    std::fs::write(f.root.join("bad.mp4"), b"broken").unwrap();
    assert!(crate::app::media::decode(&f.root.join("bad.mp4"), &out, |_, _| Ok(())).is_err());
}
