#[test]
#[ignore = "uses real Windows audio devices and plays eight seconds of synthetic test audio"]
fn wasapi_loopback_checkpoint_pause_resume_and_microphone() {
    use std::{os::windows::process::CommandExt, time::Duration};
    let project = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let root = project
        .join("target/audio-smoke-v020")
        .join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&root).unwrap();
    std::fs::create_dir(root.join("system")).unwrap();
    std::fs::create_dir(root.join("microphone")).unwrap();
    let app = tauri::Builder::default()
        .any_thread()
        .build(tauri::generate_context!())
        .unwrap();
    let recorder = lecturerelay_desktop_lib::Recorder::default();
    let id = uuid::Uuid::new_v4().to_string();
    let path = root.join("system/recording.wav");
    recorder
        .start(
            app.handle().clone(),
            id.clone(),
            path.clone(),
            root.join("recovery.json"),
            String::new(),
            "system".into(),
        )
        .unwrap();
    std::thread::sleep(Duration::from_secs(2));
    assert!(
        recorder.status().unwrap().unwrap().duration_seconds > 1.5,
        "system capture must preserve idle playback time"
    );
    let mut playback=std::process::Command::new("powershell.exe").args(["-NoProfile","-Command","$p=New-Object System.Media.SoundPlayer $env:LECTURERELAY_SMOKE_AUDIO; $p.PlayLooping(); Start-Sleep -Seconds 8; $p.Stop()"])
            .env("LECTURERELAY_SMOKE_AUDIO",project.join("target/asr-evaluation/benchmark-data/lecture.wav"))
            .creation_flags(0x08000000).spawn().unwrap();
    std::thread::sleep(Duration::from_secs(3));
    let before = recorder.status().unwrap().unwrap();
    assert!(!before.failed);
    assert!(recorder.stop("stale-lecture-id").is_err());
    assert_eq!(recorder.status().unwrap().unwrap().lecture_id, id);
    assert!(hound::WavReader::open(&path).unwrap().duration() > 0);
    recorder.pause(&id, true).unwrap();
    std::thread::sleep(Duration::from_secs(1));
    let paused = recorder.status().unwrap().unwrap().duration_seconds;
    std::thread::sleep(Duration::from_secs(1));
    assert!((recorder.status().unwrap().unwrap().duration_seconds - paused).abs() < 0.1);
    recorder.pause(&id, false).unwrap();
    std::thread::sleep(Duration::from_secs(2));
    let summary = recorder.stop(&id).unwrap();
    assert!(summary.error.is_none());
    assert!(summary.duration_seconds > 3.0);
    let reader = hound::WavReader::open(&path).unwrap();
    let rate = reader.spec().sample_rate;
    let samples = reader
        .into_samples::<i16>()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert!(samples.iter().any(|s| s.unsigned_abs() > 500));
    assert!((samples.len() as f64 / rate as f64 - summary.duration_seconds).abs() < 0.02);
    let quality: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("system/recording-quality.json")).unwrap())
            .unwrap();
    assert_eq!(quality["sampleRate"], rate);
    assert_eq!(quality["failed"], false);
    assert_eq!(
        quality["droppedChunks"].as_u64().unwrap(),
        quality["droppedBuffers"].as_u64().unwrap()
            + quality["deviceDiscontinuities"].as_u64().unwrap()
    );
    println!("System capture quality: {quality}");
    playback.wait().unwrap();
    let mic = uuid::Uuid::new_v4().to_string();
    recorder
        .start(
            app.handle().clone(),
            mic.clone(),
            root.join("microphone/recording.wav"),
            root.join("mic-recovery.json"),
            String::new(),
            "microphone".into(),
        )
        .unwrap();
    std::thread::sleep(Duration::from_secs(2));
    assert!(!recorder.status().unwrap().unwrap().failed);
    assert!(recorder.stop(&mic).unwrap().duration_seconds > 1.0);
    println!("Audio smoke artifacts: {}", root.display());
}
