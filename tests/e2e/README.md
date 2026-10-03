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
