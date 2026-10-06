# Browser and installed-application tests

Two kinds of script live here:

- **Component regressions** run real React components with synthetic native replies. `pnpm test:components` runs all of them in CI.
- **Installed acceptance** drives the installed release EXE and its real WebView2 through external `tauri-driver`. These scripts are opt-in and need real audio hardware and time.

Older, version-specific acceptance scripts and their reports were removed from the tree. Release notes link to them at the last commit that contained them.

## Component regressions

`pnpm test:components` downloads a matching official EdgeDriver, starts a private Vite/driver pair on free localhost ports, runs each suite in headless Edge and then closes its processes. Run one suite with `pnpm test:components <script>`. The suites need neither Tauri nor model weights or credentials. Pages under `apps/desktop/tests/fixtures` import production components; Vite's production build does not include them.

| Suite                         | Covers                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `classroom-summary.mjs`       | Postclass outline, saved versions and appended drafts                                                   |
| `model-controls.mjs`          | Model downloads, cancellation, failed status reads and recording locks                                  |
| `audit-components.mjs`        | Note persistence and action states                                                                      |
| `caption-reader.mjs`          | Live caption ordering, partial-to-final identity, reading anchors, Jump to Live and compact layout      |
| `theme-contrast.mjs`          | Text, border and control contrast in both themes                                                        |
| `localization.mjs`            | Full app in Chinese: settings, replay, live, processing, deletion confirmations and translated warnings |
| `settings-components.mjs`     | Grouped settings, draft preservation, device enumeration and cleanup errors                             |
| `live-summary-components.mjs` | Live summary opt-in, duplicates, source replay, stale cards and manual notes                            |

Evidence goes to ignored folders under `target/`. These suites do not establish installed WebView2, real audio or model inference behavior.

## Installed acceptance

Run only with an explicitly authorized test course, nonprivate audio and time for the real hardware session. Release builds always use the Windows Known Folders; they do not honor the debug fixture-root override. Test courses and lectures stay labelled `[ACCEPTANCE…]`; the suites select that exact course and never delete recordings or other courses. Back up the closed library before running.

### Preparation

1. Build the installer with `pnpm release`, then install it with `scripts/verification/installer.ps1`. NSIS updates current-user shortcuts and uninstaller registration, so do not install into a disposable folder.
2. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test/setup-webdriver.ps1`. It installs pinned `tauri-driver` 2.1.0 inside `.tools` and the matching Edge driver from Microsoft. Re-run it after a WebView2 update.
3. In a separate terminal run `.tools/webdriver/bin/tauri-driver.exe --native-driver <repo>\.tools\webdriver\edge\msedgedriver.exe --port 4444 --native-port 4445`. Close any other LectureRelay instance first. Set `LECTURERELAY_WEBDRIVER_PORT` when using another port.
4. Run `node tests/e2e/webdriver.mjs start <installed-path>/lecturerelay-desktop.exe`. In the GUI create the labelled acceptance course, include `中文 日本語 한국어` in its background, add `mitochondria` to its glossary, download Nemotron and select local speech. Leave cloud text set to `none`; the suites refuse a cloud-enabled configuration.
5. Move and resize the native outer window with native controls. EdgeDriver window commands may move only the embedded WebView2.
6. Test tooling needs developer Python with `psutil`, `numpy` and `matplotlib`. Set `LECTURERELAY_TEST_PYTHON` if it is not at `C:/ProgramData/miniconda3/python.exe`. The installed app does not need Python.

### Classroom flow, faults and soak

```powershell
python tests/e2e/prepare-audio.py --seconds 100 --output target/installed-acceptance/short.wav
python tests/e2e/prepare-audio.py --seconds 5420 --output target/installed-acceptance/soak.wav
node tests/e2e/student-flow.mjs
node tests/e2e/faults.mjs
node tests/e2e/soak.mjs 5400
```

- `student-flow.mjs` performs real clicks and text entry, system-output playback with WASAPI recording, captions, scrolling and Jump to Live, pause/resume, Stop, timestamp playback, correction, exports, Trash/restore and restart. `finish-review.mjs` and `finish-crash.mjs` resume a run after a controller interruption; they do not replace the capture or fault steps.
- `faults.mjs` (with `fault-injection.py`) kills only this installed app's speech worker, makes only the labelled test lecture's checkpoint destination unwritable, restores it, and kills and restarts the test app. It does not simulate a full disk, device unplug or system-wide network changes. Check the returned fault report; a controller failure is not a pass.
- `soak.mjs` enforces at least 5,400 real seconds. Audio plays through the physical default output (`play-audio.py`) and the installed app captures it; nothing feeds PCM to the recorder directly. `process-metrics.py` samples the app and all descendants every two seconds, including WebView2 processes. Summed working sets can double-count shared pages; private bytes are reported separately. After 90 minutes the script stops recording, checks finalization, plays five timestamp positions and restarts to verify stored duration and segment count.

After the soak:

```powershell
python tests/e2e/verify-wav.py --recording "<saved test recording.wav>" --source target/installed-acceptance/soak.wav --references target/installed-acceptance/soak.references.json --output target/installed-acceptance/soak-wave.json
python tests/e2e/analyse-soak.py
node tests/e2e/key-form-negative.mjs
```

`verify-wav.py` reads every declared frame and compares the known synthetic envelope at probes across the timeline and the tail. It does not establish natural classroom audio quality or word accuracy. `key-form-negative.mjs` enters only a short invalid value, checks local rejection and field clearing, and makes no cloud request; never put a real key in a script.

### Audio sources

Accuracy, latency and classroom performance claims need real lecturer audio from TED or university open courses, as described in the [audio source policy](../../docs/testing/audio-sources.md). The synthetic soak audio only exercises continuity and resource behavior.

Do not infer authenticated cloud behavior, device unplug, disk-full recovery, laptop power or fan noise, or a security audit from these runs.
