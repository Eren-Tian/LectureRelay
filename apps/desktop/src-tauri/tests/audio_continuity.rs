//! Hardware evidence only. Uses production Recorder with a test app handle, no AI/WebView flow.
use lecturerelay_desktop_lib::InputSource;
use std::{
    path::Path,
    process::Child,
    thread::sleep,
    time::{Duration, Instant},
};

fn play(project: &Path, root: &Path, source: &str, log: &str) -> Child {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("python.exe")
        .arg(project.join("tests/e2e/continuity-play.py"))
        .arg("--audio")
        .arg(root.join(source))
        .arg("--log")
        .arg(root.join(log))
        .creation_flags(0x08000000)
        .spawn()
        .unwrap()
}

#[test]
#[ignore = "real WASAPI/microphone, deterministic audible source; requires target/ci-audio/source.wav (30 seconds)"]
fn real_record_only_continuity_lifecycle() {
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let root = project.join("target/ci-audio");
    assert!(root.join("source.wav").is_file());
    let app = tauri::Builder::default()
        .any_thread()
        .build(tauri::generate_context!())
        .unwrap();
    let recorder = lecturerelay_desktop_lib::Recorder::default();
    for (scenario, source) in [
        ("continuous", InputSource::System),
        ("pause-idle", InputSource::System),
        ("microphone", InputSource::Microphone),
    ] {
        if std::env::var("LECTURERELAY_CONTINUITY_SCENARIO").is_ok_and(|value| value != scenario) {
            continue;
        }
        let suffix = std::env::var("LECTURERELAY_CONTINUITY_ATTEMPT").unwrap_or_default();
        assert!(
            suffix
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-')
        );
        let directory = root.join(format!("native-{scenario}{suffix}"));
        std::fs::create_dir_all(&directory).unwrap();
        assert!(
            !directory.join("recording.wav").exists(),
            "Preserve prior evidence; move it before rerunning"
        );
        let started = Instant::now();
        recorder
            .start(
                app.handle().clone(),
                scenario.into(),
                directory.join("recording.wav"),
                directory.join("recovery.json"),
                std::env::var("LECTURERELAY_CONTINUITY_DEVICE").unwrap_or_default(),
                source,
            )
            .unwrap();
        sleep(Duration::from_secs(2));
        let mut player = play(
            &project,
            &root,
            "source.wav",
            &format!("native-{scenario}{suffix}-playback.jsonl"),
        );
        if scenario == "pause-idle" {
            sleep(Duration::from_secs(10));
            recorder.pause(scenario, true).unwrap();
            sleep(Duration::from_secs(2));
            recorder.pause(scenario, false).unwrap();
        }
        assert!(player.wait().unwrap().success());
        if scenario == "pause-idle" {
            sleep(Duration::from_secs(3));
            assert!(
                play(
                    &project,
                    &root,
                    "tail.wav",
                    &format!("native-{scenario}{suffix}-playback.jsonl")
                )
                .wait()
                .unwrap()
                .success()
            );
        }
        sleep(Duration::from_secs(2));
        assert!(recorder.stop("stale-session").is_err());
        let status = recorder.status().unwrap().unwrap();
        let summary = recorder.stop(scenario).unwrap();
        assert!(summary.error.is_none());
        assert!(recorder.stop(scenario).is_err());
        let wav = hound::WavReader::open(directory.join("recording.wav")).unwrap();
        let samples = wav.duration();
        let rate = wav.spec().sample_rate;
        for sample in wav.into_samples::<i16>() {
            sample.unwrap();
        }
        let result = serde_json::json!({"scenario":scenario, "scope":"real native Recorder, no AI", "elapsedSeconds":started.elapsed().as_secs_f64(), "savedSeconds":summary.duration_seconds, "samples":samples, "rate":rate, "status":status});
        std::fs::write(
            directory.join("result.json"),
            serde_json::to_vec_pretty(&result).unwrap(),
        )
        .unwrap();
        println!("{result}");
    }
}
