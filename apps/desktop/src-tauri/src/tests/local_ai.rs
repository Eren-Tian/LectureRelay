use super::*;
use crate::providers::{Role, configured_text};
use std::{
    sync::{Arc, Mutex},
    time::Instant,
};

fn state(fixture: &Fixture) -> crate::AppState {
    let state = crate::AppState {
        audio_preview: Default::default(),
        performance: crate::speech::local::performance::Performance::new(false).unwrap(),
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
    };
    for id in [
        crate::models::catalog::TRANSLATION,
        crate::models::catalog::STUDY,
    ] {
        let model = crate::models::catalog::get(id).unwrap();
        let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/local-ai-evaluation/models")
            .join(model.file);
        std::fs::hard_link(
            source,
            crate::models::manager::path_for(&state, id).unwrap(),
        )
        .unwrap();
        let manifest = serde_json::json!({"id":id,"revision":model.revision,"sha256":model.sha256,"runtimeVersion":model.runtime});
        std::fs::write(
            state.paths.data.join(format!("models/{id}.json")),
            manifest.to_string(),
        )
        .unwrap();
        state
            .storage
            .install_model(id, model.revision, model.sha256, model.size)
            .unwrap();
    }
    state
}

#[test]
#[ignore = "requires pinned local weights; verifies streaming HTTP cancellation and model reuse"]
fn local_stream_preview_preemption_and_final() {
    use crate::providers::LiveTranslationControl;
    use std::sync::atomic::{AtomicBool, Ordering};
    let fixture = Fixture::new();
    let state = state(&fixture);
    let provider = configured_text(&state, Role::Translation, true).unwrap();
    tauri::async_runtime::block_on(provider.prepare_live()).unwrap();
    let source = TranscriptSegment {
        id: "stream-fixture".into(), lecture_id: "fixture".into(),
        source_text: "Correlation does not imply causation. Increasing sample size reduces sampling error but does not remove confounding.".into(),
        start_seconds:0., end_seconds:10., translated_text:String::new(),
        origin:SegmentOrigin::Local, provider:"local".into(),status:"final".into(),
        transcript_version:"fixture".into(), revision:0,
    };
    let obsolete = AtomicBool::new(false);
    let progress = |_: &str, _: &str| {
        obsolete.store(true, Ordering::Relaxed);
    };
    let superseded = || obsolete.load(Ordering::Relaxed);
    let interrupted = tauri::async_runtime::block_on(provider.translate_live(
        "Statistics",
        std::slice::from_ref(&source),
        "zh",
        LiveTranslationControl {
            progress: &progress,
            superseded: &superseded,
            preview: true,
        },
    ));
    assert!(
        obsolete.load(Ordering::Relaxed),
        "The actual model must stream before completing"
    );
    assert_eq!(
        interrupted.err().unwrap(),
        crate::providers::local::SUPERSEDED
    );
    let mut final_source = source;
    final_source.source_text = "The initial count is 42, not 24.".into();
    let output = Mutex::new(String::new());
    let progress = |id: &str, text: &str| {
        assert_eq!(id, "stream-fixture");
        *output.lock().unwrap() = text.into();
    };
    let superseded = || false;
    let at = Instant::now();
    let result = tauri::async_runtime::block_on(provider.translate_live(
        "Numbers",
        &[final_source],
        "zh",
        LiveTranslationControl {
            progress: &progress,
            superseded: &superseded,
            preview: false,
        },
    ))
    .unwrap();
    assert_eq!(result.len(), 1);
    assert!(result[0].text.contains("42") && result[0].text.contains("24"));
    assert_eq!(*output.lock().unwrap(), result[0].text);
    assert!(
        at.elapsed().as_secs() < 30,
        "A cancelled preview must not occupy the decoder indefinitely"
    );
    println!(
        "Streamed preview cancelled on first output; subsequent final completed in {} ms",
        at.elapsed().as_millis()
    );
}

#[test]
#[ignore = "downloads Hy-MT2 once plus a cancelled attempt into an isolated fixture"]
fn local_text_download_cancel_verify_and_remove() {
    let fixture = Fixture::new();
    let state = state(&fixture);
    let id = crate::models::catalog::TRANSLATION;
    crate::models::manager::remove_model(&state, id).unwrap();
    let cancelled = tauri::async_runtime::block_on(crate::models::manager::download_model_with(
        &state,
        id,
        |status| {
            if status.downloading && status.downloaded_bytes > 0 {
                state
                    .models
                    .cancel
                    .store(true, std::sync::atomic::Ordering::Relaxed);
            }
        },
    ));
    assert_eq!(cancelled.unwrap_err(), "Model download cancelled.");
    assert!(
        !crate::models::manager::status_for(&state, id)
            .unwrap()
            .installed
    );
    assert!(!crate::models::manager::downloading(&state).unwrap());
    assert!(
        !crate::models::manager::path_for(&state, id)
            .unwrap()
            .with_extension("part")
            .exists()
    );
    tauri::async_runtime::block_on(crate::models::manager::download_model_with(
        &state,
        id,
        |_| {},
    ))
    .unwrap();
    assert!(
        crate::models::manager::status_for(&state, id)
            .unwrap()
            .installed
    );
    crate::models::manager::remove_model(&state, id).unwrap();
    assert!(
        !crate::models::manager::status_for(&state, id)
            .unwrap()
            .installed
    );
    assert!(
        crate::models::manager::status_for(&state, crate::models::catalog::STUDY)
            .unwrap()
            .installed
    );
    println!(
        "Cancelled partial download cleaned; pinned SHA verified; text model removed independently."
    );
}

#[test]
#[ignore = "requires downloaded pinned Hy-MT2/Qwen weights; runs real local CPU inference"]
fn local_ai_translation_summary_review_and_cancel() {
    let fixture = Fixture::new();
    let state = Arc::new(state(&fixture));
    let course = fixture.course(&state.storage);
    state
        .storage
        .save_term(&course.id, None, "race condition", "竞态条件")
        .unwrap();
    let lecture = state
        .storage
        .create_lecture(&state.paths, &course.id, "Offline AI acceptance")
        .unwrap();
    state
        .storage
        .finish_lecture(&lecture.id, 5400., LectureStatus::Completed)
        .unwrap();
    for (time, text) in [
        (
            0.,
            "A race condition happens when a result depends on thread scheduling. A mutex protects a shared counter. The initial count is 42, not 24.",
        ),
        (
            2700.,
            "Correlation does not imply causation. Increasing sample size reduces sampling error but does not remove confounding.",
        ),
        (
            5300.,
            "At the end of class: use random assignment to reduce confounding. The final review example is mitochondria producing ATP during cellular respiration.",
        ),
    ] {
        state
            .storage
            .save_segment(
                &lecture.id,
                None,
                SegmentInput {
                    start_seconds: time,
                    end_seconds: time + 10.,
                    source_text: text.into(),
                    translated_text: String::new(),
                },
            )
            .unwrap();
    }
    let started = Instant::now();
    let job = state.jobs.begin(&lecture.id, "translation").unwrap();
    let translated =
        tauri::async_runtime::block_on(crate::app::assistance::translate_all(&state, &lecture.id));
    job.finish(&translated).unwrap();
    translated.unwrap();
    let translation_ms = started.elapsed().as_millis();
    let detail = state.storage.detail(&lecture.id).unwrap();
    assert!(
        detail
            .segments
            .iter()
            .all(|s| !s.translated_text.is_empty())
    );
    assert!(detail.segments[0].translated_text.contains("42"));
    println!(
        "Translation {translation_ms} ms: {}",
        detail.segments[0].translated_text
    );
    let started = Instant::now();
    let job = state.jobs.begin(&lecture.id, "review").unwrap();
    let review = tauri::async_runtime::block_on(crate::app::assistance::review(
        &state,
        &lecture.id,
        "Explain the major concepts, cite timestamps and include the final review example. Write three practice questions.",
    ));
    job.finish(&review).unwrap();
    review.unwrap();
    let review_ms = started.elapsed().as_millis();
    let connection = rusqlite::Connection::open(fixture.paths.data.join("app.db")).unwrap();
    let body: String = connection
        .query_row(
            "SELECT body FROM note_versions WHERE origin='local'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(
        body.contains("ATP"),
        "Final lecture example omitted: {body}"
    );
    let output = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../target/local-ai-evaluation/smoke.json");
    std::fs::write(output, serde_json::to_vec_pretty(&serde_json::json!({"translationMs":translation_ms,"reviewMs":review_ms,"segments":detail.segments,"review":body})).unwrap()).unwrap();
    // Cancel during a cold model load/request, through the same job signal as the app.
    let job = state.jobs.begin(&lecture.id, "question").unwrap();
    let signal = state.clone();
    let thread = std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        signal.jobs.cancel();
    });
    let started = Instant::now();
    let result = tauri::async_runtime::block_on(crate::app::assistance::answer(
        &state,
        &lecture.id,
        "Explain the whole class in detail.",
    ));
    thread.join().unwrap();
    assert!(result.is_err());
    assert!(started.elapsed().as_secs() < 5);
    job.finish(&result).unwrap();
    assert_eq!(state.storage.segments(&lecture.id).unwrap().len(), 3);
    println!(
        "Review {review_ms} ms; cancelled in {} ms; original segments preserved.",
        started.elapsed().as_millis()
    );
}

#[test]
#[ignore = "real classroom comparison: two models × three languages × fixed samples"]
fn classroom_translation_comparison() {
    let fixture = Fixture::new();
    let state = state(&fixture);
    let examples = [
        (
            "concurrency",
            "A race condition is not a competition. Protect the shared counter with a mutex.",
            "race condition = 竞态条件 / 競合状態 / 경쟁 상태; mutex = 互斥锁 / ミューテックス / 뮤텍스",
        ),
        (
            "numbers",
            "The concentration decreased from 0.25 to 0.05 mol/L; it did not increase by 20 percent.",
            "Chemistry: preserve concentrations, units and negation.",
        ),
        (
            "causality",
            "Correlation does not imply causation. Failing to reject the null hypothesis does not prove that it is true.",
            "Statistics lecture on hypothesis testing.",
        ),
        (
            "condition",
            "If the derivative is zero, the point may be a maximum, a minimum, or neither. Check the second derivative before drawing a conclusion.",
            "Calculus: critical points and the second derivative test.",
        ),
    ];
    let mut rows = Vec::new();
    for role in [Role::Translation, Role::Study] {
        let provider = configured_text(&state, role, false).unwrap();
        for target in ["zh", "ja", "ko"] {
            for (id, source, context) in examples {
                let segment = TranscriptSegment {
                    id: id.into(),
                    lecture_id: "evaluation".into(),
                    start_seconds: 0.,
                    end_seconds: 10.,
                    source_text: source.into(),
                    translated_text: String::new(),
                    origin: SegmentOrigin::Manual,
                    provider: "".into(),
                    status: "final".into(),
                    transcript_version: "evaluation".into(),
                    revision: 0,
                };
                let started = Instant::now();
                let result =
                    tauri::async_runtime::block_on(provider.translate(context, &[segment], target));
                let elapsed = started.elapsed().as_millis();
                let row = serde_json::json!({"model":role.model(),"language":target,"case":id,"source":source,"context":context,"milliseconds":elapsed,"result":result});
                println!("{} {} {}: {} ms", role.model(), target, id, elapsed);
                rows.push(row);
                let output = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("../../../target/local-ai-evaluation/translation-comparison.json");
                std::fs::write(output, serde_json::to_vec_pretty(&rows).unwrap()).unwrap();
            }
        }
    }
    assert!(rows.iter().all(|row| row["result"].get("Ok").is_some()));
}

#[test]
#[ignore = "requires pinned speech/text weights and a documented real lecturer WAV; runs the full live session"]
fn live_session_transcribes_and_translates_a_real_lecture() {
    let project = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let audio = std::env::var_os("LECTURERELAY_LIVE_AUDIO")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            project.join("target/local-latency/audio/MIT9_00F04_lec01-60s-150s.wav")
        });
    let fixture = Fixture::new();
    let state = Arc::new(state(&fixture));
    let speech = crate::models::manager::path(&state);
    std::fs::hard_link(
        project
            .join("target/asr-evaluation/models")
            .join(crate::models::manager::MODEL_FILE),
        &speech,
    )
    .unwrap();
    std::fs::write(
        speech.with_file_name(format!("{}.json", crate::models::manager::MODEL_ID)),
        serde_json::json!({"id":crate::models::manager::MODEL_ID,"revision":crate::models::manager::REVISION,"sha256":crate::models::manager::HASH,"runtimeVersion":"NeMo-Speech.cpp 0.1.0"}).to_string(),
    )
    .unwrap();
    state
        .storage
        .install_model(
            crate::models::manager::MODEL_ID,
            crate::models::manager::REVISION,
            crate::models::manager::HASH,
            crate::models::manager::SIZE,
        )
        .unwrap();
    assert!(crate::models::manager::status(&state).unwrap().installed);
    state
        .storage
        .save_settings(AppSettings {
            speech_provider: SpeechEngine::Local,
            translation_mode: if std::env::var_os("LECTURERELAY_LIVE_ENGLISH_ONLY").is_some() {
                ProcessingMode::None
            } else {
                ProcessingMode::Local
            },
            live_translation: true,
            ..Default::default()
        })
        .unwrap();
    let course = fixture.course(&state.storage);
    let lecture = state
        .storage
        .create_lecture(&state.paths, &course.id, "Live session acceptance")
        .unwrap();
    let (duration, recorder) = record_in_real_time(
        &audio,
        &state.paths.recording(&course.id, &lecture.id).unwrap(),
    );
    let events = Arc::new(Mutex::new(Vec::<String>::new()));
    let seen = events.clone();
    let started = Instant::now();
    crate::speech::streaming::Live::start_with(
        state.clone(),
        Arc::new(move |status| seen.lock().unwrap().push(status.state.clone())),
        lecture.id.clone(),
    );
    recorder.join().unwrap();
    while state.live.backlog(duration) > 0.4 {
        assert!(
            state.live.active(),
            "{:?}",
            state.live.snapshot().unwrap().message
        );
        assert!(started.elapsed().as_secs() < 900, "recognition stalled");
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    let recognized = started.elapsed();
    state.live.finish();
    while state.live.active() {
        assert!(started.elapsed().as_secs() < 1200, "finalization stalled");
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    let status = state.live.snapshot().unwrap();
    assert_eq!(status.state, "ended", "{:?}", status.message);
    assert!(status.draft.is_none());
    let events = events.lock().unwrap().clone();
    assert_eq!(events.first().map(String::as_str), Some("loading"));
    assert_eq!(events.last().map(String::as_str), Some("ended"));
    assert!(events.iter().any(|state| state == "listening"));
    let detail = state.storage.detail(&lecture.id).unwrap();
    assert!(detail.lecture.transcribed_until >= duration - 0.4);
    let segments = &detail.segments;
    let words = segments
        .iter()
        .map(|s| s.source_text.split_whitespace().count())
        .sum::<usize>();
    assert!(
        segments.len() >= 5 && words >= 120,
        "{} segments, {words} words",
        segments.len()
    );
    for pair in segments.windows(2) {
        assert!(pair[0].end_seconds <= pair[1].start_seconds + 1e-6);
    }
    assert!(segments.iter().all(|s| s.origin == SegmentOrigin::Local
        && s.provider == "local"
        && s.transcript_version == "live"
        && s.end_seconds <= duration + 0.01));
    let translated = segments
        .iter()
        .filter(|s| {
            s.translated_text
                .chars()
                .any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c))
        })
        .count();
    if std::env::var_os("LECTURERELAY_LIVE_ENGLISH_ONLY").is_none() {
        assert!(
            translated * 2 >= segments.len(),
            "{translated} of {} translated",
            segments.len()
        );
    }
    assert!(
        state
            .paths
            .data
            .join("logs")
            .join(format!("{}-performance.json", lecture.id))
            .exists()
    );
    let english = segments
        .iter()
        .map(|s| {
            format!(
                "[{:.2}-{:.2}] {}",
                s.start_seconds, s.end_seconds, s.source_text
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let out = project.join("target/live-session-acceptance");
    std::fs::create_dir_all(&out).unwrap();
    let label = std::env::var("LECTURERELAY_LIVE_LABEL").unwrap_or_else(|_| "current".into());
    std::fs::write(out.join(format!("{label}-english.txt")), &english).unwrap();
    std::fs::write(
        out.join(format!("{label}-result.json")),
        serde_json::to_string_pretty(&serde_json::json!({
            "audioSeconds": duration,
            "recognitionSeconds": recognized.as_secs_f64(),
            "totalSeconds": started.elapsed().as_secs_f64(),
            "segments": segments.len(),
            "words": words,
            "translatedSegments": translated,
            "events": events.len(),
            "segmentsDetail": segments,
        }))
        .unwrap(),
    )
    .unwrap();
    println!("{english}");
}

/// Write `source` to `target` at real-time pace, refreshing the WAV header
/// about every second like the recorder's checkpoints. Returns its duration.
fn record_in_real_time(
    source: &std::path::Path,
    target: &std::path::Path,
) -> (f64, std::thread::JoinHandle<()>) {
    let reader = hound::WavReader::open(source).unwrap();
    let spec = reader.spec();
    let samples = reader
        .into_samples::<i16>()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    let duration = samples.len() as f64 / f64::from(spec.sample_rate);
    let mut writer = hound::WavWriter::create(target, spec).unwrap();
    writer.flush().unwrap();
    let thread = std::thread::spawn(move || {
        let step = spec.sample_rate as usize / 10;
        let started = Instant::now();
        for (index, chunk) in samples.chunks(step).enumerate() {
            for sample in chunk {
                writer.write_sample(*sample).unwrap();
            }
            if index % 10 == 9 {
                writer.flush().unwrap();
            }
            let due = started + std::time::Duration::from_millis(100 * (index as u64 + 1));
            if let Some(wait) = due.checked_duration_since(Instant::now()) {
                std::thread::sleep(wait);
            }
        }
        writer.finalize().unwrap();
    });
    (duration, thread)
}
