# Windows CI and audio continuity — 0.3.3 candidate

Status: completed, 2026-10-04. Hosted checks and a cold installer build passed. A preliminary installed run exposed real application queue loss; the targeted correction passed regressions and a new **90m05.11s** installed observation of the actual CI artifact. Source-content comparison, restart replay and original-data/preference preservation passed within the limits below. This is a PR candidate, not a Release; no historical 0.3.1 result is substituted.

## Baseline and delivery

- Branch: `codex/windows-ci-audio-continuity`, created from remote `main` at `d0c441f` (merged 0.3.2 work).
- Build tooling commit: `70d6c07`; audio commit: `120f749`; Actions commit: `d29e480`. [CI guide](../development/ci.md) describes the two workflows and test tiers. [Draft PR #2](https://github.com/Eren-Tian/LectureRelay/pull/2) is open.
- First branch push was rejected because the CLI OAuth grant lacks `workflow` scope. The already authorized GitHub app successfully submitted the workflows; no further CLI grant is needed. Original local commits are preserved on `codex/windows-ci-audio-local`, and the transferred source tree was verified identical. No branch protection, repository visibility, release tag or published 0.3.2 asset was changed.
- The first packaging run failed workflow validation: runner context is unavailable in job-level `env`. Commit `749dfca` initializes the cold Cargo home in a runner step. [Windows checks](https://github.com/Eren-Tian/LectureRelay/actions/runs/37219251516) and [cold packaging](https://github.com/Eren-Tian/LectureRelay/actions/runs/37219248909) then passed on that revision. That earlier hosted installer was 16,168,275 bytes, SHA-256 `AA560448119CF6A89D1D5150F00D19D5F19734F32DDD2DF424795792C3CD0904`; it predates the queue fix and is not the final acceptance candidate.
- Product patch version is 0.3.3 because persisted capture diagnostics change the shipped application. Existing model/runtime/dependency pins are unchanged.
- Local installer: `LectureRelay_0.3.3_x64-setup.exe`, 16,164,184 bytes, SHA-256 `E14A16CD4052457E176A7948E553E0CA42A59FCB5D5F58C97175A45DC1A9047C`. This is a **developer-machine build**, not a cold hosted artifact. Stable current-user installation, EXE payload, canonical icons, runtime hashes and notices passed verification; the database hash did not change during installation.

The corrected **CI acceptance candidate** is source `59503ca754ab6c9d1cae3900d28e52b0d3fafd21`: [all checks passed](https://github.com/Eren-Tian/LectureRelay/actions/runs/37220850983), [cold installer passed](https://github.com/Eren-Tian/LectureRelay/actions/runs/37220847433) in 15m16s. Artifact `windows-x64-59503ca754ab6c9d1cae3900d28e52b0d3fafd21-cold` contains `LectureRelay_0.3.3_x64-setup.exe`, **16,170,994 bytes**, SHA-256 **`A29AB6368B9EE2D3FBCE69C6155D75E963CE99B386BF95A06F457063B2FFBB65`**, its checksum file and complete build/payload metadata. No project/dependency cache was restored; no model weights were needed. Subsequent report/test-harness commits do not change the product or build inputs; this exact artifact is the one installed and tested below.

Runner: `windows-2025`, image `win25-vs2026` / `20260925.250.1`, Windows 10.0.26100, Visual Studio Enterprise 2026 18.10.12217.157. Tools: Node 24.15.0, pnpm 11.25.0, Rust/Cargo 1.98.1. Native inputs remain NeMo-Speech.cpp 0.1.0 CPU (archive `5e4ea81046012edcd77fd8848de8eefb5a4ba38cc26f52eb544ab184695a75d6`) and llama.cpp b11366 CPU (archive `33dbed3c969e394e2977105e89f5c4b5dbbb5233d038d14b6954b3d32bbde9ec`). Metadata contains lockfile, runtime-manifest and every installed payload hash. This is clean buildability, not binary reproducibility.

That exact downloaded installer was installed to the stable current-user Programs directory with `-BuildMetadata`. Its app/native resource set and hashes, icons and license/NOTICE files matched; the database hash was unchanged during installation. The installed EXE SHA-256 is `B03BBF926A0C6AC43364E8EF7CF53AE118FEBF9618BEA3CAEF2721E2229AF882`.

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

The callback has no file I/O or waiting locks. A preallocated 8,192-event ring uses `try_lock`; overload discards diagnostics, not captured audio. Snapshot serialization is outside the callback. The bounded/nonblocking regression passes. Existing Stop/stale-session, atomic write, checkpoint/recovery and independent-recording tests remain intact. After the queue correction, ordinary Rust results are 53 application tests plus one workspace environment test passed; hardware/model/credential opt-ins remain excluded. Clippy with denied warnings passed locally.

## Repeatable content experiment

`tests/e2e/continuity-source.py` creates 48 kHz mono PCM speech plus a seeded continuous 3.8–6.2 kHz pilot. Speech clips repeat; the pilot does not. The two short source pieces are contiguous parts of a unique 40-second reference (30 seconds plus a distinct 10-second tail). No private audio is used or published.

`analyse-continuity.py` compares 100 ms pilot windows every 250 ms and adds 25 ms steps within one second of persisted events. Alignment grid is 62.5 microseconds, correlation threshold 0.75 and reported offset-jump threshold 2 ms. Offset jumps are retained, not warped away. The full WAV is separately read for structural validity. Calibration detects deliberate 25 ms deletion, repetition and inserted silence, and rejects all-silent false matches.

Limits: 150 ms between ordinary probe windows can conceal cancelling defects; initial/final edge samples and low-confidence probes need separate inspection. Acoustic microphone filtering can prevent pilot matching. This is not a perceptual-quality or recognition-accuracy score.

Repeat the opt-in short experiment with the already available non-sensitive speech fixtures:

```powershell
python tests/e2e/continuity-source.py --output target/ci-audio/reference-short.wav --seconds 40 --short-suite
python tests/e2e/test-continuity-analysis.py
node scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --test audio_continuity --locked -- --ignored --nocapture
python tests/e2e/analyse-continuity.py --source target/ci-audio/source.wav --recording target/ci-audio/native-continuous/recording.wav --output target/ci-audio/native-continuous/analysis.json
```

The native test refuses to overwrite an existing recording; preserve it and select a fresh `LECTURERELAY_CONTINUITY_ATTEMPT` suffix for another attempt. `LECTURERELAY_CONTINUITY_SCENARIO` selects `continuous`, `pause-idle` or `microphone`; `LECTURERELAY_CONTINUITY_DEVICE` optionally selects an explicitly enumerated device ID. Analyse pause/idle against `reference-short.wav`. The detector separately checks the first/last 25 ms; both matched in the native continuous case.

For installed tests, install/verify the candidate, launch the existing driver, move the **native outer frame** to the authorized monitor, and run `continuity-installed.mjs`. It requires the pre-test backup and installed local models, creates a labelled course and enables live translation for the following long test. Close the driver and relaunch the plain app before that long test. Run `observe-installed-90.py --root target/ci-audio --audio target/ci-audio/source-90.wav --seconds 5405 --course "<exact labelled course>" --title "[ACCEPTANCE] v0.3.3 continuity 90 minutes"` before starting that exact lecture through native UI. Generate `source-90.wav` with `--seconds 5400`; the extra five observation seconds preserve the source tail. Stop recording through native UI after the observer finishes. Restore original preferences through Settings and run `audit-preservation.py after --root target/ci-audio` afterwards. All fixture generation, heavier analysis and local builds precede or follow the timed run.

## Short real-device results

Same default loopback device (MOONDROP Rays), 48 kHz stereo input converted to mono, source and volume unchanged. Both native record-only and installed local-AI paths start with silence. Pause begins about 10 seconds into playback for two seconds; playback then finishes, remains idle for three seconds and resumes with the distinct tail. Native tests use the production Recorder with a test app handle; only the installed rows exercise the actual React/WebView and models.

| Scope                          | Saved seconds | Device events | Queue loss | Content result                                                                                                       |
| ------------------------------ | ------------: | ------------: | ---------: | -------------------------------------------------------------------------------------------------------------------- |
| Native, continuous             |         34.21 |             1 |          0 | 120/120 probes matched, no >2 ms offset jump                                                                         |
| Native, pause/idle             |         45.39 |             2 |          0 | 151/160 matched; nine unmatched probes in deliberate pause, -2.060 s pause and +3.230 s playback-idle offset changes |
| Installed local AI, continuous |         36.42 |             1 |          0 | 120/120 matched, no >2 ms offset jump; two saved bilingual segments                                                  |
| Installed local AI, pause/idle |         45.84 |             2 |          0 | 151/160 matched; deliberate pause -2.090 s, playback-idle +3.220 s; three saved bilingual segments                   |

The continuous device event precedes the first captured packet, before test speech. Pause runs add an event on resume, where the known omitted interval corresponds to deliberate recording pause plus asynchronous command response. Native pause gating discarded 5,280 samples (110 ms) while the backend pause command was still pending; this is recorded separately from device loss. No sustained-playback device event occurred in these short runs. The saved idle interval was retained; the application inserted no silence. Classifications are **expected lifecycle behavior supported by evidence**, with **no additional audio impact detected at the stated resolution**, not a universal guarantee about future device events.

After commit `59503ca`, native record-only repetitions on the same device again passed: continuous 34.20 seconds, 120/120 matching probes and a constant 2.110-second initial offset; pause/idle 45.29 seconds, 151/160 matches with only the intended -2.050-second pause and +3.170-second playback gap. All four first/tail probes matched above 0.998 correlation. Device events were again startup/resume only, queue loss and accepted-but-unwritten samples were zero, and pause gating separately counted 4,800 samples (100 ms). No operation exceeded the 50 ms slow-event threshold in these short repetitions.

Installed Stop returned in about 46 ms in both runs. Real bilingual captions, saved warning visibility, timestamp playback and trace persistence passed. The app was actually closed/restarted without the driver, and both labelled lectures remained visible. Native stale/repeated Stop checks passed. These installed short results precede the queue correction.

The corrected **CI artifact's installed short workflow** also passed: continuous 36.83 seconds, 120/120 probes, constant 2.520-second offset, two bilingual segments and Stop in 67 ms; pause/idle 45.82 seconds, 152/160 probes with only intended -2.080-second pause and +3.180-second idle offsets, three bilingual segments and Stop in 50 ms. First/tail probes matched above 0.998 in both. Startup/resume flags remained visible and persisted; queue loss, accepted-but-unwritten samples and diagnostic persistence failures were zero. Actual timestamp playback and a normal restart preserved both lectures. The driver was then closed before the long test.

The first microphone attempt inside the execution sandbox failed to start. A separate authorized retry outside the sandbox successfully captured Yeti GX at 48 kHz for 34.19 saved seconds, with no device events or queue drops and a structurally readable WAV. Playback went to headphones, so the microphone did not capture the reference pilot (0/120 matching probes). This verifies microphone startup/capture/save, **not acoustic content completeness**. Physical unplug was not performed.

## Reproduced application loss and correction

The preliminary plain installed application run was stopped normally after about 25 real minutes, preserving a 1,498.23-second WAV and its warning. Local ASR, local translation and Quiet Mode were active, with no attached WebDriver. It lost **129 buffers / 61,920 samples / 1.29 seconds**. Four groups at approximately 1,219.74–1,220.63, 1,222.04–1,222.36, 1,448.98–1,448.99 and 1,450.07–1,450.10 monotonic seconds account for 0.90, 0.33, 0.02 and 0.04 seconds respectively. Unique-pilot waveform alignment found exactly those four negative offset jumps. All saved WAV frames remained readable. This is **application buffer loss with observed audio impact**, not an inference from a device flag. The only device event was at startup.

The old queue held 64 packets: only 640 ms for this device's 480-frame packets at 48 kHz. During each loss group the writer position stopped advancing while the callback continued; queued minus written samples reached exactly 30,720 (64 × 480). The prior trace did not time filesystem/scheduling/emission operations, so the initial writer stall's specific cause remains unresolved.

Commit `59503ca` replaces that packet-only capacity with a **five-second mono-sample budget**, reserved atomically before enqueue and released by the writer. A separate 8,192-packet cap bounds allocation overhead; at 48 kHz the sample budget is 480,000 PCM bytes. Callback sends remain nonblocking. Exceeding either cap still counts exact discarded buffers/samples and preserves the visible warning. The fix tolerates bounded writer stalls; it cannot promise lossless capture during arbitrarily long disk or scheduling stalls.

The regression withholds the consumer while 200 real-size packets arrive (two seconds): the old implementation fails with 65,280 lost samples; the correction preserves all 96,000 samples in order. A separate test confirms the five-second cap, exact overflow accounting and reusable capacity after consumption. Slow writer/flush/sync/recovery/status/trace operations (at least 50 ms) now add bounded duration events outside the audio callback to characterize any recurrence.

## Completed installed long run

The corrected hosted artifact completed **5,405.110 real observation seconds (90m05.11s)** with Nemotron local speech, Hy-MT2 local translation, Quiet Mode and actual Windows loopback capture/playback. The 5,400-second source SHA-256 is `663e96afca9aa190fee5b5adcd5069f3faef5f41777888e56bc7b12a2b78bf9f`. The installed app ran normally with no attached WebDriver or injected JS/native IPC. External observation collected 2,678 process/SQLite samples at approximately two-second intervals and persisted diagnostics at approximately 30-second intervals. Sparse native checks at about 1, 10, 20, 41, 60 and 80 minutes showed advancing bilingual captions on the authorized portrait display. No forced GC, app reset or worker restart was used; only one ASR worker identity and one translation worker identity appeared during capture.

The raw recording is **5,500.84 seconds (91m40.84s)**. The controller stopped it after observation completed: an initial indexed UI click did not change state; a re-observed visible-button click did. Only one backend Stop request exists. This is automation uncertainty, not evidence of a failed or delayed application Stop request. The retained file includes 1.220 seconds before the source and 99.620 seconds after its end; this captured tail was not trimmed or aligned away. Backend Stop request to WAV finalization took 16.651 ms, which is not a measurement of click-to-UI latency. The UI explicitly displayed “Recording saved” and “Remaining captions are processing. You can play saved audio now.”

### Event and content evidence

- Final trace is complete: received, queued and written counts all equal **264,040,320 mono samples at 48 kHz**. Queue-full, closed-receiver, paused and accepted-but-unwritten sample counts are all zero. No recovery silence was inserted, and no diagnostic events were omitted or persistence writes failed.
- One device discontinuity occurred at **19.114 ms**, before the first packet and before source playback. No device event occurred during sustained source playback. Its exact upstream missing-sample count remains unknown. Classification: **expected startup lifecycle behavior, with no source-audio impact detected at the tested resolution**.
- All **21,600/21,600** ordinary source probes matched at the same **1.220-second offset**, with no offset jump above 2 ms. First and last 25 ms probes matched at correlations 0.99986 and 0.99990. Every WAV frame was readable.
- There were **47 slow-operation events**: 30 WAV sync, nine recovery writes and eight status emissions. Forty-three were within source playback; their **3,440/3,440** dense probes all matched at the same offset. Four later slow events were in the captured tail beyond the known source, so they have no source-content comparison. No application loss, repetition or shift was detected in the known source at the detector's stated resolution.

The trace identifies two status-emission wall durations of **784.348 ms at 1,362.834 s** and **676.960 ms at 1,363.716 s** during source playback. Queued-but-unwritten audio reached 37,440 samples (780 ms) and 32,160 samples (670 ms), respectively, exceeding the old queue's 640 ms budget. The new buffer retained these samples and content alignment remained continuous. Another 677.614 ms status emission occurred after the source finished. These are measured time spent in the emission operation, potentially including scheduling delay; they do not isolate an internal WebView/OS cause or prove that every earlier stall had this cause. Synchronous emission remains finite work on the writer; the bounded queue protects against the observed stalls, while stalls exceeding five seconds can still produce explicitly counted loss.

### Resource and task behavior

CPU is measured for the entire app process group and normalized to the machine's **32 logical CPUs**: mean **7.10%**. Summed working-set peak was **3,957.92 MiB** and private committed-memory peak **5,617.97 MiB** during the observer window. Shared pages may be counted multiple times in summed working sets; private commitment is not resident memory.

| Observation window | Group working-set median MiB | Group private median MiB | WebView private median MiB |
| ------------------ | ---------------------------: | -----------------------: | -------------------------: |
| 5–15 minutes       |                      3834.27 |                  5476.71 |                     353.00 |
| 40–50 minutes      |                      3898.85 |                  5558.72 |                     433.64 |
| 80–90 minutes      |                      3951.97 |                  5593.52 |                     466.73 |

Private memory grew approximately **116.81 MiB** between early and late windows, mostly in WebView. This result does not establish an absence of memory growth or a leak. The sampled speech backlog and pending translation queue were zero at each persisted performance sample; external two-second snapshots had at most one saved English segment awaiting translation. This sampling can miss brief queues. At observer completion 271 English segments and 270 translations were saved; after Stop, **271/271** were saved. The final persisted performance sample reported mean speech compute 612 ms (peak 2,874 ms) and translation request mean 2,150 ms (peak 6,447 ms). These are internal processing durations, not measured sound-to-screen latency or a translation-quality evaluation.

Post-stop external observation kept the same ordinary app open for 60.78 seconds: both AI workers exited, all 271 translations remained, and process-group memory fell to **568.20 MiB working set / 467.52 MiB private**, without GC or restart. Only then was the app closed normally and restarted for verification. All 271 local bilingual segments and the visible recording warning persisted. Five actual timestamp playback checks at **0, 1,340, 2,700, 4,040 and 5,400 seconds** advanced audio playback without an error; saved duration remained 5,500.84 seconds. This is selected playback verification, not a full human listening review.

## Preservation, exclusions and remaining uncertainty

The baseline contained six courses, 33 lectures and 35 existing WAV/GGUF/BIN files. After testing, **all original rows across all 18 SQLite tables were unchanged**, including preferences, transcript/edit/version records and task records. All 35 original file hashes matched; SQLite quick-check returned `ok` and foreign-key checks returned no errors. Live translation was temporarily enabled and then restored through Settings; exact original preference equality passed. Labelled synthetic test courses and recordings are retained. The test app session and dedicated driver were closed. Databases, audio, detailed machine paths and raw traces remain in ignored `target/ci-audio` or the local test library; only sanitized results are committed.

Verified ordinary CI covers frontend types/build, repository checks, both formatters, three real React fixtures, **53 application Rust tests plus one environment test**, and Clippy with warnings denied. Ten library and two integration hardware/model/credential tests are explicitly ignored by that tier, not declared passed. Targeted device/model/installed tests above were separate opt-ins.

There is no remaining execution blocker for this scoped PR. Remaining evidence limits are the probe gaps described above, unknown exact upstream loss from device flags, the internal cause of slow status emission, and modest observed WebView memory growth. This desktop cannot establish student-laptop battery, fan noise or power behavior. Paid/authenticated cloud, physical unplug, fresh-machine WebView2 bootstrap, code signing and a full listening review of 90 minutes were not tested. No merge, Release publication, main-protection change or alteration of existing 0.3.2 assets was performed.
