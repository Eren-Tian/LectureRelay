# Installed LectureRelay v0.2.0 acceptance — 2026-09-30

Status: installed student flow, controlled faults and the full application **90-minute local run completed**. Recording, captions, sampled replay and restart checks passed. Resource acceptance remains open because WebView2 memory grew throughout the run. Authenticated cloud processing was not tested, as requested by the user. This is not a claim that all A–D acceptance criteria passed.

## Scope and artifact

The user authorized testing on this machine for 90 real minutes and declined paid cloud tests. No authenticated cloud request was made. The app was installed from the actual current-user NSIS installer into `target/installed-acceptance/app`; it uses the production Windows library/database folders. The initial library contained no courses. All created data is labelled `[ACCEPTANCE…]` and is retained for inspection.

Installer SHA-256: `206712B46506EE36B0382C2649E9990047C2C51C4771344B47BFB346855FEB93`.

Installed EXE SHA-256: `891B13D35D0FE7E4B4C363C74881A764AB89526E8D67AD3471D52792544E48B7`.

Installer exited 0; installed version is 0.2.0. Worker, nine DLLs, 13 notices and six phoenix icon sizes match the audited package. Computer Use launched and inspected the installed app. Launching the installer wizard through Computer Use hit an application-approval timeout, so installation was completed through the authorized NSIS `/S /D=` entry point. The installer wizard's interaction is **not verified**.

Repeatable flows use external Tauri WebDriver 2.1.0 and Edge WebDriver/WebView2 154.0.4258.37 against the installed release binary. No Vite server, mock runtime, IPC mocking or embedded automation plugin is used. [Tauri's native testing documentation](https://v2.tauri.app/develop/tests/webdriver/manual-setup/) supports this route.

## Acceptance matrix

| Area                                  | Evidence / result                                                                                                                                                                                | Remaining limit                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Course, background, glossary          | Real GUI creation and UTF-8 Chinese/Japanese/Korean saved and reopened                                                                                                                           | —                                                                                     |
| Local model                           | Actual GUI download of pinned 667 MiB model; Installed status; real CPU worker produced captions                                                                                                 | No student laptop tested                                                              |
| Audio sources                         | Microphone selected and short recording saved; default speaker selected for real WASAPI loopback                                                                                                 | No physical device unplug or microphone speech-quality session                        |
| Captions and navigation               | Visible English captions; actual wheel scroll and Jump to Live; pause clock stable, resume successful                                                                                            | Accuracy on diverse real classrooms remains unproven                                  |
| Replay, correction, exports           | Actual timestamp/player playback; correction retained; JSON and Markdown contain multilingual text                                                                                               | Sampled playback, not full-duration human listening                                   |
| Trash and restart                     | Test course moved to Trash/restored; restart kept audio and edited transcript                                                                                                                    | —                                                                                     |
| STT worker exit                       | Real installed worker killed; audio continued from 8+ seconds to 13.15 seconds; visible AI failure and saved recording hint                                                                      | Speech retries tested separately from live restart                                    |
| Checkpoint write failure              | Only test lecture checkpoint replaced with empty directory; explicit failure at 9.12 seconds; prior WAV playable and saved Interrupted                                                           | Not an actual full disk or audio-device write failure                                 |
| App crash                             | Installed app killed during recording; restart recovered ~8 seconds; recovery notice and actual player playback verified                                                                         | Last checkpoint can omit up to about one second of unflushed tail                     |
| Runtime credential/errors             | Installed password form rejected four-character invalid input, cleared the field and saved no key; unique synthetic Credential Manager roundtrip; actual local HTTP errors did not echo canaries | No real key entered; no authenticated official-provider or independent security audit |
| Full application 90 minutes           | 5,400.35 real seconds; 5,400.68 seconds saved audio; 461 segments; five timestamp plays and restart passed; full WAV readable and matching synthetic signal across 234 probes                    | WebView2 memory growth; DOM latency is not exact visible-screen latency               |
| Cloud STT / translation / Notes / Q&A | **Not tested**, per user's no-paid-cloud choice                                                                                                                                                  | Valid user-entered key and cost authorization needed in a future round                |

The failure records in `student-flow-attempt*.json` and `faults-attempt*.json` are retained. Test-controller issues included an overly high scroll threshold, attempting controls while finalization/export was busy, assuming a worker filename, and reading before a recovered page loaded. Completed steps were preserved, resumed and validated; these failures are not hidden as product passes. Final flow/fault evidence is in `student-flow.json` and `faults.json`.

## Changes made during acceptance

Live status now exposes active/finalizing state and counts in-flight translation along with queued batches. After Stop the replay page/sidebar distinguishes saved audio from remaining caption/translation processing, allows playback, and blocks another class/edit until work finishes. Missing saved translations no longer claim to be pending when no work is running. AI worker failure remains visible on replay with the saved-audio recovery path. Stop refreshes/navigates after the recorder stops even when a later snapshot write fails, and signals live finalization before potentially failing database/snapshot work.

The installed short flow observed no remaining cloud queue because cloud processing was disabled. The finalization-state regression test passed. A real queued cloud translation drain has **not** been demonstrated.

## Endurance measurements

Run: **2026-09-30 21:11:29.598–22:41:29.944 UTC**, on the installed EXE identified above. Continuous synthetic English was played through the real default Windows output and captured through WASAPI loopback. The actual React/WebView2 and native CPU speech worker ran throughout. No PCM was injected into the recorder and no translation queue was simulated.

| Measurement                                                 | Result                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual elapsed capture monitoring                           | 5,400.346 seconds                                                                                                                                  |
| Saved audio / transcript                                    | 5,400.68 seconds / 461 final segments                                                                                                              |
| First caption in actual DOM, from monitoring start          | 3.095 seconds                                                                                                                                      |
| Partial chunk-end → DOM proxy                               | Median 1.59 s; P95 2.29 s; peak 2.63 s; 2,092 changed-text samples                                                                                 |
| Final chunk-end → DOM proxy                                 | Median 1.75 s; P95 2.421 s; peak 2.69 s; 459 samples, with two more segments finalized after Stop                                                  |
| Speech backlog                                              | Maximum sampled 3.01 s; no sustained increase                                                                                                      |
| Translation queue / translation latency                     | Disabled / not measured                                                                                                                            |
| Full process-group CPU, normalized by 32 logical processors | Mean 5.36%; P95 7.14%; peak 11.41%                                                                                                                 |
| Sum of process working sets                                 | Peak 2,569.82 MiB; first 1–5 minute median 1,485.24 MiB; last ten minute median 2,490.35 MiB                                                       |
| Sum of private committed memory                             | Mean 4,496.14 MiB; peak 5,106.99 MiB                                                                                                               |
| Native speech worker working set                            | Peak 935.83 MiB; essentially stable after load                                                                                                     |
| WebView2 renderer working set                               | Peak 1,193.40 MiB; continued growth after the 200-caption display cap                                                                              |
| Combined dropped/discontinuous counter                      | 1 at startup, no subsequent increase                                                                                                               |
| Replay / restart                                            | Actual HTML audio playback at five transcript positions, including near the end; duration and all 461 segments retained after restart              |
| Whole-file WAV verification                                 | 259,232,640 mono PCM16 frames at 48 kHz read; 234 distributed signal probes; minimum envelope correlation 0.958, last-ten-second correlation 0.956 |

The process group includes the root app, all WebView2 descendants, native speech and related console hosts. Summed working sets can double-count shared pages; private bytes measure committed memory rather than resident RAM. CPU is a mean of the regular two-second process-group samples. See [harness measurement definitions](../../tests/e2e/README.md#full-application-soak-evidence).

The latency proxy is captured frame clock minus processed chunk end when the corresponding text is found in the real DOM. It includes one-second polling and about 0.2-second recorder-status quantization. It is not an exact acoustic-word-to-pixel measurement. A read-only viewport check at 1180 × 780 CSS pixels found the caption panel extending to y=846.72 and the latest paragraph ending at y=824.72, so part of the latest caption was below the viewport until the main panel was scrolled. Fully visible-screen latency and an adaptive live layout remain open. The five playback checks validate actual player behavior but do not mean a person listened to the entire recording.

The audio warning remained visible. The counter combines WASAPI xrun notifications and actual bounded-queue overflows, so it does not identify a lost buffer by itself. Whole-file and synthetic-envelope checks passed, including the tail; the warning is nevertheless retained and is not rewritten as zero drops or a guarantee of perfect classroom audio.

Memory grew by **1,005.11 MiB** between the early and late working-set window medians. The cause has not been isolated between application behavior and automation/runtime retention. The run polled DOM/native status every second and requested screenshots repeatedly throughout each 15-minute milestone minute; the resource chart shades those screenshot intervals. No forced garbage collection, application restart or state reset occurred during capture. The future harness now requests only one screenshot per milestone, but that correction does not change the cadence of this preserved run. A run with reduced/detached automation and a renderer heap profile is needed before accepting memory stability.

After Stop, local processing finished quickly and the remaining-work banner was not captured. A real queued cloud-translation drain remains unverified. Reopening showed completed transcription and “No translation saved”, with no misleading pending translation for the disabled provider. The recovery banner visible in earlier live screenshots belongs to the preceding deliberate crash test, not a crash during the soak.

Retained local artifacts under `target/installed-acceptance`: `installer.json`, `student-flow.json`, `faults.json`, `key-form-negative.json`, `soak-result.json`, `soak-summary.json`, `soak-wave.json`, `soak-ui.jsonl`, `soak-processes.jsonl`, `soak-playback.jsonl`, `soak.references.json`, `soak-process-peaks.json`, `soak-viewport.json`, `soak-resources.png`, and the screenshots directory. Build/test artifacts remain ignored; the measured summary above is preserved in this source document. The labelled test library/recordings remain available in the app.

This is an i9-13900KF / 64 GiB / RTX 4090 desktop with other apps running. The installed model uses the CPU. This test cannot establish laptop battery use, fan noise or classroom audio quality, and system-wide GPU activity cannot be assigned to LectureRelay.

## Validation

Release frontend build, web type check, 18 normal Rust tests, Clippy with warnings denied, Rust formatting and installed resource/icon checks passed. The actual local HTTP 401/403/429/503/malformed response fixture and dedicated Windows credential roundtrip passed. The installed invalid-input form check and whole-file WAV verification passed. Final repository formatting and link/import/credential hygiene checks passed: 193 source files, 30 frontend modules, zero candidate credentials and zero audit issues. That pattern scan remains a hygiene check, not an independent audit. The future screenshot-cadence correction was made after this run and passed JavaScript syntax checks; production code and the installed EXE were not changed during or after the endurance run.

Physical device unplug, a system network outage, true full-disk/audio-write failure, ordinary student laptop power/noise, authenticated official STT/translation/Notes/Q&A and a complete runtime security audit remain untested. The installer wizard interaction also remains unverified. These gaps and the memory/viewport findings prevent a blanket classroom-release acceptance claim.
