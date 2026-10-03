# Validation and test tiers

## Normal checks

`pnpm run doctor`, `pnpm check:web`, `pnpm build:web`, `pnpm test:rust`, `pnpm lint:rust`, `pnpm format:check`, `pnpm format:rust:check`, `pnpm verify:repo`, `pnpm verify:resources`.

Rust module-local tests cover PCM conversion, WAV encoding, retrieval, safe provider errors and model cancellation. `src-tauri/src/tests` contains integration-style checks using private APIs: schema 1→2, reopen, multilingual data, Trash, atomic files, checkpoint recovery, cursor/correction preservation, path/timeline validation and exclusive jobs. Their UUID fixtures live under `target/test-fixtures`, not user folders.

The public native-audio integration binary under `src-tauri/tests` is compiled by normal tests but its hardware case is ignored. Preserve its Common Controls v6 manifest and the test-only linker directives in `build.rs`; do not apply them to the production binary.

## Opt-in native acceptance

Prepare nonprivate JFK/model evaluation fixtures as documented in [experiments](../../experiments/local-stt/README.md). The native STT check exercises partial/final output, 48 kHz conversion and worker failure. The credential check writes/removes only a synthetic unique target.

```powershell
pnpm test:native
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test/native-smoke.ps1 -Audio -DownloadModel
```

`-Audio` captures real microphone/render-loopback hardware with deliberate synthetic playback, checkpoint and pause/resume checks. `-DownloadModel` contacts official Hugging Face infrastructure, cancels the first download, verifies the full 667 MiB install/license/load, then removes only its isolated fixture. No real provider target or production database is modified. UI fixture setup/manual acceptance is in [fixture policy](../../tests/fixtures/README.md).

Authenticated cloud acceptance is separate and requires an explicitly supplied valid key. Do not infer success from connection metadata, mock results or missing-key checks.

## Local text AI preview

The [0.3 evaluation report](local-ai-v0.3.md) records actual Hy-MT2/Qwen/Bergamot comparisons, isolated native WebView checks and their limits. Opt-in commands and model prerequisites are in [local AI experiments](../../experiments/local-ai/README.md). These are separate from installed-release and endurance acceptance.

## Long soak

`tests/soak/local-stt.py` is the opt-in real wall-clock native/WAV/SQLite harness using the preserved experimental worker policy. It defaults to 5,400 seconds; translation pressure is simulated. Prepare its worker with `experiments/local-stt/scripts/build-nemo.ps1`, then run with developer Python 3.12. New runs write timestamped `target/asr-evaluation/endurance-*` directories. A short path smoke can set `LECTURERELAY_SOAK_SECONDS=12`; that is not a replacement for the prior 90-minute result.

Never run the full soak in normal CI. Rerun it when relevant production streaming/timing behavior changes, not for documentation/module moves. Preserve [historical evidence and limits](local-stt-benchmark-v0.2.md).

## Installed application acceptance

[Windows E2E harness](../../tests/e2e/README.md) drives the installed release through native WebDriver, actual audio capture and React/WebView2. Its full application soak is separate from the native harness above. The [current v0.3.1 acceptance](installed-acceptance-v0.3.1.md) covers recoverable long review, confirmed cleanup, final GUI regressions and a completed independent 90-minute run without injected driver polling. The [v0.3 report](installed-acceptance-v0.3.md) preserves the original review failures and driver-retention finding; [v0.2](installed-acceptance-v0.2.md) remains earlier evidence. These reports do not certify classroom accuracy, authenticated cloud services, ordinary laptops or every failure path.

## Packaging

`pnpm release` builds the release EXE and English current-user NSIS installer, validates worker/DLL/notice/icon staging, and writes a SHA-256 beside the installer. Verify installed resources with `scripts/verification/runtime-resources.ps1 -RuntimePath <installed-directory>/local-asr`. Use an isolated custom install directory for tests; preserve production data and prior release installers. Native resource tests do not establish complete GUI or authenticated cloud acceptance.

For a complete packaging smoke run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verification/installer.ps1`. It installs into a fresh `target/installer-cleanup-<UUID>` directory (updates current-user installer registration/shortcuts), checks resource hashes, version, application payload and PE icon images for app/installer/uninstaller, and compares the user database hash. It does not launch the production application or uninstall user content. The isolated installation remains available for inspection.
