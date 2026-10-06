use super::*;
use crate::{app::live_summaries as engine, database::live_summaries::*};

#[test]
fn storage_and_model_cleanup_cannot_race_an_active_summary() {
    let f = Fixture::new();
    let storage = std::sync::Arc::new(f.db());
    let state = crate::AppState {
        audio_preview: Default::default(),
        performance: crate::speech::local::performance::Performance::new(true).unwrap(),
        paths: f.paths.clone(),
        recorder: Default::default(),
        jobs: crate::app::jobs::Jobs::persistent(storage.clone()),
        live: Default::default(),
        summaries: Default::default(),
        models: Default::default(),
        runtime: std::path::PathBuf::new(),
        gate: Default::default(),
        recovered_count: 0,
        _instance_lock: f.paths.acquire_instance_lock().unwrap(),
        storage,
    };
    let model = state
        .paths
        .data
        .join("models")
        .join(crate::models::catalog::get("qwen3.5-4b").unwrap().file);
    std::fs::write(&model, b"fixture").unwrap();
    let flight = state.summaries.test_flight().unwrap();
    assert!(
        crate::commands::ensure_cleanup_idle(&state)
            .unwrap_err()
            .contains("总结")
    );
    assert!(
        crate::models::manager::remove_model(&state, "qwen3.5-4b")
            .unwrap_err()
            .contains("总结")
    );
    assert_eq!(std::fs::read(model).unwrap(), b"fixture");
    drop(flight);
    assert!(crate::commands::ensure_cleanup_idle(&state).is_ok());
}

fn segment(n: usize) -> TranscriptSegment {
    TranscriptSegment {
        id: format!("s{n}"),
        lecture_id: "l".into(),
        start_seconds: (n * 60) as f64,
        end_seconds: (n * 60 + 59) as f64,
        source_text: format!("Example {n}: the limit is 2 mg, not 3 mg."),
        translated_text: String::new(),
        origin: "local".into(),
        provider: "local".into(),
        status: "final".into(),
        transcript_version: "original".into(),
        revision: 0,
    }
}
fn lecture(f: &Fixture, db: &Storage) -> Lecture {
    let c = f.course(db);
    let l = db
        .create_lecture(&f.paths, &c.id, "Summary regression")
        .unwrap();
    db.finish_lecture(&l.id, 1200., "completed").unwrap();
    l
}
fn add(db: &Storage, l: &Lecture, n: usize) -> SummarySource {
    let s = segment(n);
    db.save_segment(
        &l.id,
        None,
        SegmentInput {
            start_seconds: s.start_seconds,
            end_seconds: s.end_seconds,
            source_text: s.source_text,
            translated_text: String::new(),
        },
    )
    .unwrap();
    SummarySource::from(
        db.segments(&l.id)
            .unwrap()
            .iter()
            .find(|s| s.start_seconds == (n * 60) as f64)
            .unwrap(),
    )
}
fn points(card: &SummaryCard) -> Vec<SummaryPoint> {
    (0..3)
        .map(|_| SummaryPoint {
            text: "剂量上限为 2 mg，而非 3 mg。".into(),
            source_ids: vec![card.sources[0].id.clone()],
        })
        .collect()
}
#[test]
fn summaries_upgrade_opt_in_and_validate_independently() {
    let legacy: AppSettings =
        serde_json::from_str(r#"{"speechProvider":"local","translationMode":"local"}"#).unwrap();
    assert!(!legacy.live_summaries.enabled);
    assert_eq!(legacy.live_summaries.interval_minutes, 4);
    assert_eq!(legacy.live_summaries.provider, "groq");
    assert_eq!(legacy.live_summaries.model, "openai/gpt-oss-120b");
    let f = Fixture::new();
    let db = f.db();
    db.save_settings(legacy.clone()).unwrap();
    let mut settings = db.settings().unwrap();
    settings.live_summaries.enabled = true;
    assert!(db.save_settings(settings.clone()).is_err());
    settings.live_summaries.upload_consent = true;
    db.save_settings(settings).unwrap();
    let settings = db.settings().unwrap();
    assert_eq!(settings.speech_provider, legacy.speech_provider);
    assert_eq!(settings.translation_mode, legacy.translation_mode);
    assert_eq!(settings.study_mode, legacy.study_mode);
    for invalid in [0, 1, 3, 6, u32::MAX] {
        let p = LiveSummaryPreferences {
            interval_minutes: invalid,
            ..Default::default()
        };
        assert!(p.validate().is_err());
    }
}

#[test]
fn legacy_local_summary_settings_become_off_without_changing_saved_content() {
    let f = Fixture::new();
    let db = f.db();
    let l = lecture(&f, &db);
    let old_preferences = LiveSummaryPreferences {
        enabled: true,
        provider: "local".into(),
        model: "qwen3.5-4b".into(),
        interval_minutes: 2,
        upload_consent: true,
    };
    // Represent a card created by 0.3.9, before local live summaries were removed.
    let card = db
        .reserve_summary(&l.id, &old_preferences, vec![add(&db, &l, 0)])
        .unwrap();
    db.finish_summary(&card, "旧本地总结", &points(&card))
        .unwrap();
    db.save_note(&l.id, "手写笔记保留", "manual").unwrap();
    let mut saved = serde_json::to_value(AppSettings {
        theme: "dark".into(),
        speech_provider: "local".into(),
        live_summaries: old_preferences,
        ..Default::default()
    })
    .unwrap();
    saved["futurePreference"] = serde_json::json!({"preserve": true});
    drop(db);
    let raw = rusqlite::Connection::open(f.paths.data.join("app.db")).unwrap();
    raw.execute(
        "INSERT OR REPLACE INTO app_settings(key,value) VALUES('preferences',?1)",
        [saved.to_string()],
    )
    .unwrap();
    drop(raw);

    let db = f.db();
    let settings = db.settings().unwrap();
    assert!(!settings.live_summaries.enabled);
    assert_eq!(settings.live_summaries.provider, "none");
    assert!(!settings.live_summaries.upload_consent);
    assert_eq!(settings.live_summaries.interval_minutes, 2);
    assert_eq!(settings.speech_provider, "local");
    assert_eq!(settings.translation_mode, "local");
    assert_eq!(settings.study_mode, "local");
    assert_eq!(settings.theme, "dark");
    let cards = db.summary_cards(&l.id).unwrap();
    assert_eq!(cards.len(), 1);
    assert_eq!(cards[0].provider, "local");
    assert_eq!(cards[0].state, "completed");
    assert_eq!(
        serde_json::to_value(&cards[0].sources).unwrap(),
        serde_json::to_value(&card.sources).unwrap()
    );
    assert_eq!(db.note(&l.id).unwrap().unwrap().body, "手写笔记保留");
    drop(db);
    let raw = rusqlite::Connection::open(f.paths.data.join("app.db")).unwrap();
    let text: String = raw
        .query_row(
            "SELECT value FROM app_settings WHERE key='preferences'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let value: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(value["liveSummaries"]["provider"], "none");
    assert_eq!(value["futurePreference"]["preserve"], true);
    drop(raw);
    assert!(f.db().settings().unwrap().live_summaries == settings.live_summaries);
}

#[test]
fn obsolete_clients_cannot_reenable_local_live_summaries() {
    let f = Fixture::new();
    let db = f.db();
    let original = db.settings().unwrap();
    for enabled in [false, true] {
        let mut requested = original.clone();
        requested.live_summaries.provider = "local".into();
        requested.live_summaries.enabled = enabled;
        assert!(
            requested
                .live_summaries
                .validate()
                .unwrap_err()
                .contains("已停用")
        );
        assert!(db.save_settings(requested).is_err());
        assert!(db.settings().unwrap().live_summaries == original.live_summaries);
    }
    // A legacy settings row written after startup is also exposed as Off.
    let raw = rusqlite::Connection::open(f.paths.data.join("app.db")).unwrap();
    raw.execute(
        "INSERT OR REPLACE INTO app_settings(key,value) VALUES('preferences',?1)",
        [r#"{"liveSummaries":{"provider":"local","enabled":true}}"#],
    )
    .unwrap();
    let effective = db.settings().unwrap().live_summaries;
    assert!(!effective.enabled);
    assert_eq!(effective.provider, "none");
    assert!(effective.validate().is_ok());
}

#[test]
fn disabling_local_does_not_reset_an_explicit_cloud_summary_selection() {
    let f = Fixture::new();
    let db = f.db();
    let settings = AppSettings {
        live_summaries: LiveSummaryPreferences {
            enabled: true,
            upload_consent: true,
            ..Default::default()
        },
        ..Default::default()
    };
    db.save_settings(settings.clone()).unwrap();
    drop(db);
    assert!(f.db().settings().unwrap().live_summaries == settings.live_summaries);
}
#[test]
fn windows_use_final_whole_segments_and_do_not_repeat_coverage() {
    let mut segments: Vec<_> = (0..11).map(segment).collect();
    segments[1].status = "partial".into();
    segments[2].source_text = "  ".into();
    for minutes in [2, 4, 5] {
        let p = LiveSummaryPreferences {
            interval_minutes: minutes,
            ..Default::default()
        };
        let first = engine::select_sources(&segments, &[], &p, false);
        assert_eq!(first.first().unwrap().id, "s0");
        assert!(first.last().unwrap().end_seconds >= f64::from(minutes * 60));
        assert!(first.iter().all(|s| s.id != "s1" && s.id != "s2"));
        let f = Fixture::new();
        let db = f.db();
        let l = lecture(&f, &db);
        let source = add(&db, &l, 0);
        let mut card = db.reserve_summary(&l.id, &p, vec![source]).unwrap();
        card.sources = first.clone();
        let next = engine::select_sources(&segments, &[card], &p, true);
        assert!(next.iter().all(|s| first.iter().all(|old| old.id != s.id)));
    }
    assert!(engine::select_sources(&segments[..1], &[], &Default::default(), false).is_empty());
    assert_eq!(
        engine::select_sources(&segments[..1], &[], &Default::default(), true).len(),
        1
    );
    assert!(engine::select_sources(&[], &[], &Default::default(), true).is_empty());
    segments[0].source_text = "a".repeat(8000);
    segments[3].source_text = "b".repeat(8000);
    assert_eq!(
        engine::select_sources(&segments, &[], &Default::default(), false).len(),
        1
    );
}
#[test]
fn cards_preserve_manual_notes_restart_and_later_appends() {
    let f = Fixture::new();
    let db = f.db();
    let l = lecture(&f, &db);
    let s = add(&db, &l, 0);
    db.save_note(&l.id, "My manual notes", "manual").unwrap();
    let card = db
        .reserve_summary(&l.id, &Default::default(), vec![s.clone()])
        .unwrap();
    assert!(
        db.reserve_summary(&l.id, &Default::default(), vec![s])
            .is_err()
    );
    assert!(
        db.finish_summary(&card, "剂量上限", &points(&card))
            .unwrap()
    );
    add(&db, &l, 5);
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "completed");
    assert_eq!(db.note(&l.id).unwrap().unwrap().body, "My manual notes");
    let pending = db
        .reserve_summary(&l.id, &Default::default(), vec![add(&db, &l, 6)])
        .unwrap();
    drop(db);
    let db = f.db();
    let cards = db.summary_cards(&l.id).unwrap();
    assert_eq!(cards[0].state, "completed");
    assert_eq!(cards[0].points.len(), 3);
    assert_eq!(
        cards.iter().find(|c| c.id == pending.id).unwrap().state,
        "deferred"
    );
    let retried = db
        .retry_summary(&l.id, &pending.id, &Default::default())
        .unwrap();
    assert_eq!(retried.id, pending.id);
    assert_eq!(db.summary_cards(&l.id).unwrap().len(), 2);
}
#[test]
fn edits_invalidate_actual_inputs_but_not_translation_changes() {
    let f = Fixture::new();
    let db = f.db();
    let l = lecture(&f, &db);
    let source = add(&db, &l, 0);
    let card = db
        .reserve_summary(&l.id, &Default::default(), vec![source.clone()])
        .unwrap();
    db.translate_segment(&l.id, &source.id, "翻译完成").unwrap();
    assert!(db.finish_summary(&card, "标题", &points(&card)).unwrap());
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "completed");
    db.save_segment(
        &l.id,
        Some(source.id.clone()),
        SegmentInput {
            start_seconds: 0.,
            end_seconds: 59.,
            source_text: "The limit is 1 mg.".into(),
            translated_text: String::new(),
        },
    )
    .unwrap();
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "stale");
    let retry = db
        .retry_summary(&l.id, &card.id, &Default::default())
        .unwrap();
    assert_eq!(retry.sources[0].text, "The limit is 1 mg.");
    db.save_segment(
        &l.id,
        Some(source.id),
        SegmentInput {
            start_seconds: 0.,
            end_seconds: 59.,
            source_text: "The limit is zero.".into(),
            translated_text: String::new(),
        },
    )
    .unwrap();
    assert!(
        !db.finish_summary(&retry, "旧结果", &points(&retry))
            .unwrap()
    );
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "stale");
}
#[test]
fn fractional_audio_times_survive_saved_snapshot_roundtrips() {
    let f = Fixture::new();
    let db = f.db();
    let l = lecture(&f, &db);
    db.save_segment(
        &l.id,
        None,
        SegmentInput {
            start_seconds: 82.23999999999965,
            end_seconds: 97.27999999999933,
            source_text: "The limit is 2 mg, not 3 mg.".into(),
            translated_text: String::new(),
        },
    )
    .unwrap();
    let source = SummarySource::from(&db.segments(&l.id).unwrap()[0]);
    let card = db
        .reserve_summary(&l.id, &Default::default(), vec![source.clone()])
        .unwrap();
    // Real capture timestamps contain fractional f64 seconds. Saving the JSON
    // snapshot must not turn an unchanged input into a source edit.
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "running");
    db.translate_segment(&l.id, &source.id, "译文已完成")
        .unwrap();
    assert!(
        db.finish_summary(&card, "剂量上限", &points(&card))
            .unwrap()
    );
    drop(db);
    let db = f.db();
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "completed");
    // A real time correction remains detectable even without a text revision.
    rusqlite::Connection::open(f.paths.data.join("app.db"))
        .unwrap()
        .execute(
            "UPDATE transcript_segments SET end_seconds=end_seconds+0.001 WHERE id=?1",
            [&source.id],
        )
        .unwrap();
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "stale");
}
#[test]
fn parser_rejects_untraceable_or_incomplete_results_and_maps_real_refs() {
    let f = Fixture::new();
    let db = f.db();
    let l = lecture(&f, &db);
    let card = db
        .reserve_summary(&l.id, &Default::default(), vec![add(&db, &l, 0)])
        .unwrap();
    let good = serde_json::json!({"title":"原文中的限制","points":(0..3).map(|_|serde_json::json!({"text":"上限为 2 mg，而非 3 mg。","sourceIds":["S1"]})).collect::<Vec<_>>()});
    let (_, points) = engine::parse(&good.to_string(), &card).unwrap();
    assert_eq!(points[0].source_ids, [card.sources[0].id.clone()]);
    for bad in [
        serde_json::json!({"title":"t","points":[]}),
        serde_json::json!({"title":"t","points":[{"text":"claim","sourceIds":["S99"]},{"text":"claim","sourceIds":["S1"]},{"text":"claim","sourceIds":["S1"]}]}),
        serde_json::json!({"title":"t","points":[{"text":"claim","sourceIds":[]},{"text":"claim","sourceIds":["S1"]},{"text":"claim","sourceIds":["S1"]}]}),
    ] {
        assert!(engine::parse(&bad.to_string(), &card).is_err());
    }
    assert!(engine::parse("{\"title\":", &card).is_err());
    for (language, name) in [
        ("zh", "Simplified Chinese"),
        ("ja", "Japanese"),
        ("ko", "Korean"),
    ] {
        let mut card = card.clone();
        card.language = language.into();
        let (system, user) = engine::prompt(&card, "course context");
        assert!(system.contains(name));
        assert!(user.contains("S1"));
        assert!(!user.contains(&card.sources[0].id));
    }
}
#[test]
fn groq_payload_supports_structured_output_without_conflicting_reasoning_flags() {
    let body = crate::providers::summary_payload("groq", "openai/gpt-oss-120b", "s", "u");
    assert_eq!(body["reasoning_effort"], "low");
    assert_eq!(body["include_reasoning"], false);
    assert!(body.get("reasoning_format").is_none());
    assert_eq!(body["stream"], false);
    assert_eq!(body["response_format"]["json_schema"]["strict"], true);
    assert_eq!(
        crate::providers::summary_payload("openai", "gpt-4o-mini", "s", "u")["store"],
        false
    );
}
#[test]
fn single_flight_and_provider_cooldowns_do_not_spill_between_providers() {
    let engine = engine::LiveSummaries::default();
    let flight = engine.test_flight().unwrap();
    assert!(engine.test_flight().is_err());
    drop(flight);
    assert!(!engine.busy());
    engine.rate_limited("groq", 30);
    assert!(engine.check_cooldown("groq").is_err());
    assert!(engine.check_cooldown("openai").is_ok());
    let generation = engine.generation();
    engine.cancel();
    assert!(!engine.matches_generation(generation));
}

#[test]
fn dropped_summary_work_reports_failure_without_overwriting_a_completed_card() {
    let f = Fixture::new();
    let db = f.db();
    let l = lecture(&f, &db);
    let card = db
        .reserve_summary(&l.id, &Default::default(), vec![add(&db, &l, 0)])
        .unwrap();
    {
        let _completion = engine::CardCompletion {
            storage: &db,
            id: &card.id,
        };
    }
    assert_eq!(db.summary_cards(&l.id).unwrap()[0].state, "failed");
    let retry = db
        .retry_summary(&l.id, &card.id, &Default::default())
        .unwrap();
    {
        let _completion = engine::CardCompletion {
            storage: &db,
            id: &card.id,
        };
        db.finish_summary(&retry, "已完成", &points(&retry))
            .unwrap();
    }
    let saved = &db.summary_cards(&l.id).unwrap()[0];
    assert_eq!(saved.state, "completed");
    assert_eq!(saved.title, "已完成");
}
