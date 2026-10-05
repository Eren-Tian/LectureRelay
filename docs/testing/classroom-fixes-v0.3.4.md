# Classroom controls and caption throughput — 0.3.4

Tested on 2026-10-05. The reported configuration was microphone input, Quiet Mode enabled, with captions continuously falling behind. The reported two-minute backlog was not reproduced on this machine; these changes address verified causes and expose actionable state when a slower machine falls behind.

## Changes

- Caption-window creation is asynchronous. Windows WebView2 creation in a synchronous command can deadlock its event loop, as documented by [Tauri](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html). Opening captions no longer occupies the recording controls' busy state. The secondary window has a Close captions button, stays on the main window's monitor and reads caption state instead of bootstrapping the library every second.
- Course history and replay offer permanent deletion of one lecture. The dialog names the lecture, describes the scope and requires `DELETE`. Native code independently validates confirmation and activity gates. Files are staged with the durable cleanup journal before a transaction removes lecture data. Tests cover failed database commit, locked recording, sibling/course/PDF/glossary preservation and dependent rows/files.
- Getting started guides users through English/bilingual captions, required downloads, local providers, microphone/system audio and courses. Qwen remains optional. Failed Trash loading no longer disables unrelated model controls; connection, retry, cancellation and blocked states have feedback.
- Quiet Mode still shares at most four logical CPUs across all local AI, but selects distinct physical cores before SMT siblings. Full performance uses the process's permitted CPU mask. Local text inference disables active CPU polling.
- Delay is computed from recorded audio versus audio actually processed by speech, including during inference. At more than six seconds of speech backlog, local translation yields to speech. There are at most two waiting translation batches; stale batches are deferred with saved text retained for Translate missing after class. Translation can pause/resume independently of recording. Local live requests have a 30-second bound.
- Sentence-ending hypotheses can finalize after six seconds; the existing 20-second upper bound remains. A fixed eight-second cutoff was evaluated and rejected because it truncated words in two short quality clips. Sentence finalization, model loading and generation still take time.

## Executable/UI verification

`tests/e2e/classroom-fixes.mjs` refuses any database outside `target/classroom-fixes/ui-1/app-data/app.db` and refuses a configured cloud provider. It drives production React assets embedded in a debug native EXE, real WebView2, microphone recording, Nemotron and Hy-MT2. This is instrumented native testing, not an independent installed-EXE memory/power test.

- Initial and final candidates each completed three caption-window open/close cycles with Stop enabled. The final candidate also passed the native Windows title-bar Close action; recording continued.
- Translation pause/resume preserved the active recording and advancing duration.
- Native UI deletion required typed confirmation; Cancel preserved the synthetic lecture. Confirm deleted only that lecture, preserving the course, glossary and newly recorded lecture. Native rollback tests cover failure paths.
- Six Settings/deletion component scenarios passed in headless Edge, as did existing note-race, caption-reader and light/dark contrast checks. These use controlled IPC replies and are distinct from native checks.
- Ordinary Rust checks passed 57 application tests and one environment test. Ten application tests and two integration tests remain opt-in. Clippy with denied warnings, frontend type/build, both formatters, repository scanning and runtime verification passed during this work.

The first five-minute microphone run evaluated the rejected eight-second cutoff. Its `target/classroom-fixes/microphone-*.json` results must not be attributed to the final segmentation policy. Final-policy evidence is stored separately under `target/classroom-fixes/final/`.

### Final microphone run

The final 0.3.4 debug native candidate recorded a real Yeti GX microphone while speakers played the non-sensitive synthetic lecture. Quiet Mode, local Nemotron speech and local Hy-MT2 Chinese translation were enabled. The observation lasted five real minutes with 149 polls at roughly two-second intervals. The native Close-button check occurred during this observation; no heavy benchmark or build ran concurrently.

| Measurement                                           | Result                                                 |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Speech processing backlog, median / p95 / maximum     | 1.88 / 3.36 / 3.95 seconds                             |
| Final-English segment age, median / p95               | 11.29 / 19.80 seconds                                  |
| Latest-translated segment age, median / p95 / maximum | 14.42 / 23.79 / 36.99 seconds                          |
| Maximum translation queue / deferred segments         | 1 / 0                                                  |
| Saved recording / final bilingual segments            | 318.79 seconds / 16 of 16                              |
| Recording Stop enabled in all observed samples        | Yes                                                    |
| WAV fully readable                                    | 15,301,920 mono frames at 48 kHz; 30,603,840 PCM bytes |

Segment age is recording progress minus the latest saved segment end. It includes finalization, initial silence and model warm-up; it is not per-word acoustic-to-screen latency or translation compute time. Live English partials continue before a final segment is saved. The result rules out a growing multi-minute backlog in this run, **not** all slow machines or an unsatisfactory translation wait. Long fluent sentences still need further latency/quality work.

Timestamp playback loaded the full saved duration and started at 00:20 without a media error. After restarting, both test recordings and the final 16 translations remained, the deleted fixture stayed deleted, and the course, glossary, Quiet Mode and local providers were preserved.

Evidence: `final/microphone-observation.json`, `final/microphone-result.json`, `final/summary.json`, `final/controls.json`, `final/restart.json`. The summary includes the tested debug EXE hash and worker source hash. Its staged worker hash was collected after recompilation of that same source, not before launch. The debug EXE and installer have different builds; the five-minute run must not be relabelled an installed-release test.

## Model-only comparison

An accelerated 120-second synthetic comparison with the same original worker measured 33.97 seconds on logical CPUs 0/1/2/3 versus 26.34 seconds on 0/2/4/6: roughly 22% less compute time in this limited comparison. This is not microphone-to-screen latency, a general hardware result or a power/noise measurement.

Four synthetic clips and one public JFK excerpt (176 normalized reference words) were processed by the original and final sentence-aware workers with identical two-second ingress. Normalized outputs matched on all five clips. Existing domain-term errors remained: eight word edits in GIS and three in biology. This smoke comparison detects the rejected cutoff regression; it does not establish classroom transcription or translation accuracy.

Evidence: `quality-before/`, `quality-sentences/`, `quality-comparison.json`, `before-siblings.json` and `before-cores.json` under `target/classroom-fixes/`. `speech-reliability.py` accepts `LECTURERELAY_ASR_RUNTIME`, `LECTURERELAY_ASR_WORKER` and `LECTURERELAY_SPEECH_EVIDENCE` overrides for comparison without changing an installed application.

## Limits

The final local installer was built and installed into the stable current-user directory with exit code 0. Version 0.3.4, EXE payload, ASR/text runtimes, licenses and icons verified; the pre-existing user database SHA-256 was unchanged by installation. The installer is 16,187,628 bytes, SHA-256 `B8F150E5592C179ACD788A60DE2A76DE993EC42BA7496F8A8AA0EC8EEF989657`. Installation evidence is copied to `target/classroom-fixes/final/installer-result.json`. This is a local build, not a new hosted CI result or GitHub Release.

No paid/cloud requests, real-library deletion, fresh-machine installation, ordinary-laptop power/noise measurements or new 90-minute soak are claimed. The prior 0.3.3 long run does not certify modified code. Cold-start translation and uninterrupted speech can still cause noticeable subtitle delay. Speech processing backlog, final-segment age and audible-word-to-painted-text latency are different measurements; do not interchange them.
