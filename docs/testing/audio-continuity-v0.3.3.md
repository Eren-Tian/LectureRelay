# Windows CI and audio continuity — 0.3.3 candidate

Status: investigation in progress, 2026-10-04. This is not a Release or a claim of completed hosted CI. The independent installed 90-minute run is currently running; the historical 0.3.1 result is not used as its result.

## Baseline and delivery

- Branch: `codex/windows-ci-audio-continuity`, created from remote `main` at `d0c441f` (merged 0.3.2 work).
- CI commit: `29e173a`. [CI guide](../development/ci.md) describes the two workflows and test tiers.
- First branch push was rejected by GitHub: the authenticated CLI OAuth grant lacks `workflow` scope. Device authorization is pending. No successful hosted run or PR exists yet. No branch protection, repository visibility, release tag or published 0.3.2 asset was changed.
- Product patch version is 0.3.3 because persisted capture diagnostics change the shipped application. Existing model/runtime/dependency pins are unchanged.
- Local installer: `LectureRelay_0.3.3_x64-setup.exe`, 16,164,184 bytes, SHA-256 `E14A16CD4052457E176A7948E553E0CA42A59FCB5D5F58C97175A45DC1A9047C`. This is a **developer-machine build**, not a cold hosted artifact. Stable current-user installation, EXE payload, canonical icons, runtime hashes and notices passed verification; the database hash did not change during installation.

## Source semantics

Inspected the exact Cargo.lock dependency, CPAL **0.18.2**, including `src/host/wasapi/stream.rs::process_input`, `input_timestamp`, `clock_position` and `Stream::play/pause`.

[Microsoft GetBuffer documentation](https://learn.microsoft.com/en-us/windows/win32/api/audioclient/nf-audioclient-iaudiocaptureclient-getbuffer) defines device position in frames and the packet QPC timestamp in 100 ns units. [Buffer flags](https://learn.microsoft.com/en-us/windows/win32/api/audioclient/ne-audioclient-_audclnt_bufferflags) distinguish discontinuity, silence and invalid timestamps. A discontinuity flag does not specify how many samples are missing.

CPAL emits `Xrun` before the associated data callback when the discontinuity bit is present and device position is nonzero. Its public callback does **not** expose device position or the timestamp-validity flag. The application must not infer missing samples from `Xrun`. CPAL queues Start/Stop commands asynchronously, so app control-request times are not hardware transition times.

Two upstream limitations are concrete in the inspected code, without an established recording defect from either:

1. `process_input` does not branch on WASAPI `SILENT` or `TIMESTAMP_ERROR`. Microsoft requires treating silent packets as silence and identifies invalid timestamp metadata separately. Existing API consumers cannot inspect these bits. This is a source-level gap, not proof that our tested device supplied incorrect sample bytes.
2. The callback timestamp comes from `IAudioClock::GetPosition`, whereas the capture timestamp comes from `GetBuffer`. On this loopback device, `callback - capture` was negative (about 1.56e12 microseconds in magnitude). We retain signed evidence and report a positive callback delay as unknown; these values are **not** end-to-end latency measurements. Relative packet capture times are also evidence, not exact loss counts.

## Bounded diagnostics

`recording-events.json` is saved every 30 seconds and after stream shutdown/finalization, best-effort alongside the existing visible `recording-quality.json` warning. It records:

- Rust monotonic elapsed time, input frame/mono queued/written positions, rate and channel context.
- Start/pause/resume/stop requests, queued backend controls, first packet, device events, packet timestamp deviations and five-second anchors.
- Exact queue-full/closed-receiver drops, deliberate pause-gating discards, non-finite replacements and accepted-but-unwritten samples; unknown upstream loss remains `null`.
- No inserted recovery silence (zero in this implementation), omitted diagnostic event count and persistence-failure count.

The callback has no file I/O or waiting locks. A preallocated 8,192-event ring uses `try_lock`; overload discards diagnostics, not captured audio. Snapshot serialization is outside the callback. The bounded/nonblocking regression passes. Existing Stop/stale-session, atomic write, checkpoint/recovery and independent-recording tests remain intact. Ordinary Rust results: 51 application tests plus one workspace environment test passed; hardware/model/credential opt-ins remain excluded. Clippy with denied warnings, formatting and repository checks passed locally.

## Repeatable content experiment

`tests/e2e/continuity-source.py` creates 48 kHz mono PCM speech plus a seeded continuous 3.8–6.2 kHz pilot. Speech clips repeat; the pilot does not. The two short source pieces are contiguous parts of a unique 40-second reference (30 seconds plus a distinct 10-second tail). No private audio is used or published.

`analyse-continuity.py` compares 100 ms pilot windows every 250 ms and adds 25 ms steps within one second of persisted events. Alignment grid is 62.5 microseconds, correlation threshold 0.75 and reported offset-jump threshold 2 ms. Offset jumps are retained, not warped away. The full WAV is separately read for structural validity. Calibration detects deliberate 25 ms deletion, repetition and inserted silence, and rejects all-silent false matches.

Limits: 150 ms between ordinary probe windows can conceal cancelling defects; initial/final edge samples and low-confidence probes need separate inspection. Acoustic microphone filtering can prevent pilot matching. This is not a perceptual-quality or recognition-accuracy score.

## Short real-device results

Same default loopback device (MOONDROP Rays), 48 kHz stereo input converted to mono, source and volume unchanged. Both native record-only and installed local-AI paths start with silence. Pause begins about 10 seconds into playback for two seconds; playback then finishes, remains idle for three seconds and resumes with the distinct tail. Native tests use the production Recorder with a test app handle; only the installed rows exercise the actual React/WebView and models.

| Scope                          | Saved seconds | Device events | Queue loss | Content result                                                                                                       |
| ------------------------------ | ------------: | ------------: | ---------: | -------------------------------------------------------------------------------------------------------------------- |
| Native, continuous             |         34.21 |             1 |          0 | 120/120 probes matched, no >2 ms offset jump                                                                         |
| Native, pause/idle             |         45.39 |             2 |          0 | 151/160 matched; nine unmatched probes in deliberate pause, -2.060 s pause and +3.230 s playback-idle offset changes |
| Installed local AI, continuous |         36.42 |             1 |          0 | 120/120 matched, no >2 ms offset jump; two saved bilingual segments                                                  |
| Installed local AI, pause/idle |         45.84 |             2 |          0 | 151/160 matched; deliberate pause -2.090 s, playback-idle +3.220 s; three saved bilingual segments                   |

The continuous device event precedes the first captured packet, before test speech. Pause runs add an event on resume, where the known omitted interval corresponds to deliberate recording pause plus asynchronous command response. Native pause gating discarded 5,280 samples (110 ms) while the backend pause command was still pending; this is recorded separately from device loss. No sustained-playback device event occurred in these short runs. The saved idle interval was retained; the application inserted no silence. Classifications are **expected lifecycle behavior supported by evidence**, with **no additional audio impact detected at the stated resolution**, not a universal guarantee about future device events.

Installed Stop returned in about 46 ms in both runs. Real bilingual captions, saved warning visibility, timestamp playback and trace persistence passed. The app was actually closed/restarted without the driver, and both labelled lectures remained visible. Native stale/repeated Stop checks passed. Microphone startup failed with “Cannot start audio capture”; microphone continuity is **not verified** and physical unplug was not performed.

## Long run and preservation

Pending: one fresh 90-minute installed 0.3.3 run using local speech/translation and Quiet Mode. The plain app has no attached WebDriver; `observe-installed-90.py` samples only external process counters, read-only SQLite and bounded persisted diagnostics. Sparse native UI checks are allowed. No forced GC, worker restart or state reset is used.

Before testing: read-only SQLite backup and hashes of 35 existing WAV/GGUF/BIN files; six courses and 33 lectures. New labelled test courses/lectures remain in the library. Original preferences are saved locally; live translation was temporarily enabled. Final preference restoration and row/file preservation comparison are pending after the long run. All databases, audio, detailed machine paths and raw traces remain in ignored `target/ci-audio` or the local test library.

This desktop cannot establish student-laptop battery, fan noise or power behavior. Paid/authenticated cloud, actual physical unplug and a full listening review of 90 minutes are outside this run.
