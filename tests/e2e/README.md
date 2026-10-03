# Installed Windows application acceptance

This suite drives the **installed release EXE and its real WebView2** through external `tauri-driver` and the matching Microsoft Edge WebDriver. It does not run Vite, mock `invoke`, use a mock runtime, or add an automation plugin to the shipped application. [Tauri manual setup](https://v2.tauri.app/develop/tests/webdriver/manual-setup/) documents this route; [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/) supplies Edge WebDriver.

Run only with an explicitly authorized test course, synthetic/public audio, and time for the real hardware session. Release builds use the actual Windows Known Folders. They do not honor the debug fixture-root override. Test courses/lectures remain labelled `[ACCEPTANCE…]`; the suite selects that exact course and fault injection additionally checks its lecture UUID/title in SQLite. It does not delete recordings or existing courses. Trash/restore operates on that test course. The NSIS installer updates current-user shortcuts/uninstaller registration.

## Preparation

1. Build the installer with `pnpm release`. Install through that NSIS package into `target/installed-acceptance/app`. Keep the installer hash and installed EXE hash in `target/installed-acceptance/installer.json`.
2. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test/setup-webdriver.ps1`. It installs pinned `tauri-driver` 2.1.0 inside `.tools` and downloads the matching Edge driver from Microsoft. Re-run after a WebView2 update.
3. In a separate terminal run `.tools/webdriver/bin/tauri-driver.exe --native-driver D:\Programming\LectureRelay\.tools\webdriver\edge\msedgedriver.exe --port 4444 --native-port 4445`. Close another LectureRelay instance before starting the session.
4. Run `node tests/e2e/webdriver.mjs start D:/Programming/LectureRelay/target/installed-acceptance/app/lecturerelay-desktop.exe`. In the installed GUI create `[ACCEPTANCE 2026-09-30] Classroom`, include `中文 日本語 한국어` in the background, and add `mitochondria` to its glossary. Download the model through Settings and select local speech. Set cloud text provider to `none`. The suite refuses a cloud-enabled configuration.
5. Prepare the four **synthetic** lecture/GIS/CS/biology WAVs using the existing [evaluation instructions](../../experiments/local-stt/README.md). Test tooling requires Python with `psutil`; the production app does not require Python. Set `LECTURERELAY_TEST_PYTHON` if developer Python is not at `C:/ProgramData/miniconda3/python.exe`.

```powershell
python tests/e2e/prepare-audio.py --seconds 100 --output target/installed-acceptance/short.wav
python tests/e2e/prepare-audio.py --seconds 5420 --output target/installed-acceptance/soak.wav
node tests/e2e/student-flow.mjs
node tests/e2e/faults.mjs
node tests/e2e/soak.mjs 5400
```

The flow performs actual UI clicks/text entry, real system-output playback and WASAPI recording, visible captions, real scrolling/Jump to Live, pause/resume, Stop, timestamp playback, correction, exports, Trash/restore and restart. `finish-review.mjs` and `finish-crash.mjs` preserve completed evidence when resuming after a test-controller interruption; they are not replacements for the preceding capture/fault steps.

`faults.mjs` kills only this installed app's `local-asr/asr-worker.exe`, makes only a labelled test lecture's checkpoint destination unwritable by temporarily substituting an empty directory, restores that destination, and deliberately kills/restarts the test app. No full disk, real-device unplug or system-wide network/security settings are simulated. Verify the returned fault report; a controller failure is not a passed test. The checkpoint backup remains under `target/installed-acceptance/fault-backups` for inspection.

## Full application soak evidence

The 5,400-second minimum is enforced against actual elapsed wall time. Audio is played continuously through the physical default output and captured by the installed app; the suite never supplies PCM directly to its recorder or speech worker. Cloud translation is disabled, not simulated.

`soak-processes.jsonl` samples the root app and all descendants every two seconds, including WebView2 renderer/GPU/network processes, native speech and related console hosts. Driver/Python/test playback processes are excluded. CPU is normalized by the machine's logical CPU count. Summed working sets can double-count shared pages; private bytes are reported separately and are committed memory, not resident memory.

`soak-ui.jsonl` records capture duration, native backlog, dropped/discontinuous counter and actual caption DOM count each second. The first-appearance latency samples require the corresponding text to be present in the real DOM. Their proxy is the captured frame clock minus processed chunk end, with up to one second polling delay and about 0.2 second recorder-status quantization. This differs from compute time and from measuring the exact acoustic word boundary. Presence in DOM does not prove that the entire caption fits in the visible viewport; the current run separately records a partially clipped latest-caption layout. Source clip timings are recorded separately.

After 90 minutes the script stops recording, checks finalization, plays timestamps at five positions including the last part, and restarts to verify stored duration/segment count. Offline WAV verification must still read the complete file; sampled playback does not claim that a person listened to the entire 90 minutes.

Post-run analysis uses Python `numpy` and `matplotlib`:

```powershell
python tests/e2e/verify-wav.py --recording "<saved test recording.wav>" --source target/installed-acceptance/soak.wav --references target/installed-acceptance/soak.references.json --output target/installed-acceptance/soak-wave.json
python tests/e2e/analyse-soak.py
node tests/e2e/key-form-negative.mjs
```

The WAV check reads all declared frames and compares the known synthetic audio envelope in probes across the timeline and at the tail. It does not establish natural classroom audio quality or word accuracy. The key-form check requires no recording/work and no existing provider credentials. It enters only a four-character invalid value, verifies local rejection and password-field clearing, and makes no cloud request. Never replace that value with a real key in a script.

The 2026-09-30 measured run requested screenshots repeatedly throughout each 15-minute milestone minute. Those bursts add measurement overhead; the resource chart marks their intervals. Resource growth observed under this instrumentation must be reported, with its cause investigated separately.

Do not infer authenticated cloud behavior, device-unplug behavior, disk-full recovery, laptop power/fan noise, or an independent security audit from these results. See the [acceptance report](../../docs/testing/installed-acceptance-v0.2.md).

## October product iteration

`product-iteration.mjs` exercises the new eight-category Settings UI, shared preferences draft, save/restart, local-model and storage status, caption visibility switches and a short real system-audio classroom run using `target/product-iteration/app/lecturerelay-desktop.exe`. It uses the existing labelled acceptance course, saves original non-secret preferences to the local evidence folder and restores them at successful completion. On controller failure inspect that file and the active app before continuing; do not overwrite the baseline with temporary test preferences.

`caption-reader.mjs` is a separate deterministic browser fixture. Start Vite and an Edge WebDriver on port 4446, then run the script. The page at `/tests/fixtures/captions.html` imports the production `LiveCaptions` component and supplies explicitly synthetic delayed translations. It verifies Chinese/Japanese/Korean ordering, partial-to-final DOM identity, manual-reading anchors when translations arrive and history is trimmed, Jump to Live, failure text and compact layout. It makes no provider requests. This fixture is not an installed-app or authenticated-cloud acceptance claim; Vite's production build does not include the fixture entry.

Both scripts write evidence under `target/product-iteration`. Screenshots of the installed app use the existing screenshot helper and have the `design-` prefix under `target/installed-acceptance/screenshots`.

## Installed v0.3 local AI acceptance

The October 3 scripts use the exact course `[ACCEPTANCE 2026-10-03] Local AI classroom` and the installed EXE under `target/acceptance-v0.3-2026-10-03/app`. They require disconnected cloud text (`provider: none`), downloaded Nemotron/Hy-MT2/Qwen models, local speech/translation/study, live translation enabled and shared Quiet Mode for the capture baseline. Set `LECTURERELAY_WEBDRIVER_PORT` when using a driver other than port 4444. Back up the actual Windows Known Folders library before running; the production EXE does not redirect it to a fixture root.

Move and resize the **native outer window** with native window controls before testing. Do not reuse the older scripts' `window/rect` or `window/maximize` commands for this WebView2: EdgeDriver may move the embedded child while leaving the outer Tauri frame in place.

```powershell
$env:LECTURERELAY_WEBDRIVER_PORT = '4448'
node tests/e2e/installed-local-live.mjs short
node tests/e2e/installed-local-study.mjs
node tests/e2e/installed-local-live.mjs soak
python tests/e2e/local-soak-progress.py
python tests/e2e/analyse-local-soak.py
node tests/e2e/post-soak-memory.mjs
node tests/e2e/installed-long-review.mjs
node tests/e2e/installed-local-faults.mjs
```

Run the capture modes sequentially and leave their playback device, app navigation and performance settings unchanged during the 90-minute baseline. This version samples the actual caption DOM every five seconds and takes exactly one screenshot per 15-minute milestone. It enforces 5,400 real seconds, then stops, waits for the replay view and remaining translation, and exercises five playback positions across transcript pagination. It does **not** automatically restart the application; verify persistence afterwards. Run the WAV-envelope check documented above against the new evidence root as a separate check.

`post-soak-memory.mjs` checks idle process/heap memory only after the completed recording and inference drain. Its optional explicit garbage collection is diagnostic, excluded from the baseline, and is not a product memory-management strategy. `local-runtime-audit.py --exe <installed-exe> --output <evidence.json>` checks the simultaneous speech/text worker affinity, loopback-only text listener and rejection of an unauthenticated metadata request without reading tokens. Add `--performance full` when explicitly testing Quiet Mode off.

`installed-long-review.mjs` processes the saved full recording with real Qwen and checks that the result is a new version without replacing manual notes or transcript. `installed-local-languages.mjs` separately enters a fixed synthetic sentence in Chinese/Japanese/Korean test courses and calls both installed translation models. These manually entered fixtures isolate translation wiring; they do not establish speech recognition or classroom translation quality.

The local fault suite checks ASR exit, translator exit, a single test lecture's checkpoint write failure and app exit. It ends with `crash-pending.json`; restart the same installed EXE, reposition the native window and verify recovered audio before recording crash recovery as passed. It neither disables real devices nor fills the disk. `verify-preserved-library.py` compares original content rows with the backup read-only, allowing new test rows and schema columns. See the [v0.3 acceptance report](../../docs/testing/installed-acceptance-v0.3.md) for results and exclusions.

After restarting the fault-test EXE, `installed-final-restart.mjs` checks recovered playback and preservation of the earlier short/long lectures. The language script can resume its labelled existing fixtures. It waits for transient toasts and uses a valid explicit segment end time; the product's invalid fractional default is recorded as a defect, not hidden by the fixture workaround.

The original EdgeDriver callback path retained native results in long timers. `webdriver.mjs` now returns a Promise through W3C `execute/sync`; avoid restoring its old `execute/async` polling. `capture-webview-heap.mjs` and `analyse-driver-retention.py` are diagnostic tools for this app only. Heap snapshots can contain app content and must remain local; never commit or publish them.

For an independent ten-minute memory observation, close the WebDriver session, launch the same installed EXE normally, and move its native frame to the portrait screen. Through native UI start `[ACCEPTANCE] Standalone memory 10 minutes` in the October 3 test course with system audio, local speech/translation and Quiet Mode. Run `python tests/e2e/standalone-observe.py`, then Stop & save through native UI. It plays the known synthetic fixture and reads only process counters and SQLite; it does not inject JavaScript or call native IPC. This shorter comparison does not replace the full ninety-minute test.

## 0.3.1 reliability checks

See [the 0.3.1 evidence report](../../docs/testing/installed-acceptance-v0.3.1.md) for completed versus pending checks. `reliability-review.mjs cancel` and `resume` use the exact saved long transcript; restart the actual app between stages. `reliability-ui.mjs` asserts an explicitly labelled debug-only database root before destructive confirmation tests; never repoint it at the everyday library.

`reliability-short.mjs` is an installed-app capture/DOM-stage check, not a memory benchmark. Start its driver with `LECTURERELAY_TRACE_CAPTIONS=1` to obtain native timestamp-only stage logs. `analyse-stages-v031.py` joins those timestamps with observed DOM appearances; read its clock/polling limitations before comparing runs. `reliability-installed-ui.mjs` additionally checks landscape recording controls, fractional editing, JSON provenance, Trash/restore and permanent deletion of **only the disposable course it just created**. Its production free-all confirmation is cancelled; actual full cleanup belongs in the isolated native fixture.

Do not use the trace environment or driver for `observe-installed-90.py --title "[ACCEPTANCE] v0.3.1 <unique title>"`. Launch the observer before starting that recording through native UI. It requires the stable installed EXE and refuses any running test driver or a requested duration below 5,400 seconds. It stops the source playback at completion, **not the recording**. Once `independent-result.json` exists, start `reliability-post-stop.py`, then click native **Stop & save** promptly. Keep that ordinary app instance open for the full 60-second post-stop observation. No forced collection, model restart or driver attachment is part of this baseline.

After the post-stop observation, close the app normally and launch the same installed EXE through the driver. Reposition its native outer frame before interacting. `reliability-post-soak.mjs` verifies saved bilingual provenance and plays five real timestamp positions across transcript pagination. `verify-wav.py --played-seconds 5400` reads every saved WAV frame; the optional duration excludes known silent recording time after playback stopped from source-correlation probes only. It does not exclude any bytes from the full-file readability check. `analyse-independent-v031.py` summarizes early/middle/late resources and `plot-independent-v031.py` creates the resource plot. Sparse native performance-file observations start only when the helper begins; do not claim continuous queue/discontinuity history from them.

`reliability-import.mjs begin` opens the installed app's real file picker for a known invalid non-sensitive file. Select it through native UI, then run `verify` to check failure wording and source preservation. For the shared study/fault scripts, set `LECTURERELAY_ACCEPTANCE_ROOT=target/acceptance-v0.3.1` and `LECTURERELAY_INSTALLED_EXE` to the stable installed EXE. The study script needs `short-result.json` pointing to the actual successful short capture, not a fabricated fixture. After the fault suite's intentional app exit, restart the installed EXE and run `reliability-restart.mjs` to verify recovered audio, manual notes, AI versions and the new long recording. Restore the baseline preferences/course Trash classification through UI, then run `preservation-v031.py --final`.

`backup-v031.py` refuses to overwrite its pre-migration backup. `preservation-v031.py` compares original data with only the explicitly listed migration/test-course exceptions. `speech-reliability.py 2 [glossary]` and `1 [glossary]` run the pinned actual worker on matching synthetic and separately labelled natural samples; `LECTURERELAY_SAVED_BOUNDARY=1` selects the original saved-audio excerpt. These accelerated worker results must not be reported as end-to-end live latency.
