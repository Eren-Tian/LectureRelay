# Test fixtures

Use only synthetic, non-sensitive samples. Ordinary Rust tests allocate independent UUID roots under `target/test-fixtures` and clean their own directories. They cover migrations/reopen, multilingual data, Trash/restore and preserved audio, timestamp/path validation, checkpoint recovery, STT progress, translation preservation, WAV encoding, retrieval, jobs and sanitized errors.

Windows Credential Manager roundtrip/replace/removal is opt-in and uses a synthetic unique target, never a real provider target:

```powershell
node scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop windows_credential_roundtrip_replace_and_remove -- --ignored
```

For native UI verification, choose a **fresh** isolated directory under `target`, prepare a labelled synthetic course with a 12-second quiet tone, and launch the debug binary with the same environment variable:

```powershell
pnpm build:debug
$env:LECTURERELAY_TEST_ROOT = Join-Path (Get-Location) 'target/ui-test-fresh'
node scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop prepare_isolated_native_ui_fixture -- --ignored
Start-Process 'target/x86_64-pc-windows-msvc/debug/lecturerelay-desktop.exe'
```

Only debug builds honor `LECTURERELAY_TEST_ROOT`; release always uses Windows Known Folders. The seed test refuses roots outside the canonical project target directory and refuses nonempty databases. Never use a production folder or add real account keys to this test environment. Close the test app before removing its isolated test directory.

Manual acceptance: create/edit a course and glossary, open lecture, play/seek WAV, edit/export transcript and notes, inspect missing-provider errors, live caption scrolling and translation visibility. Test recording with deliberate synthetic playback/microphone input in an isolated root. Device removal, disk-full and complete live/model-manager UI acceptance remain pending. Installer upgrade/uninstall/reinstall and a native 90-minute harness were tested separately; authenticated provider acceptance needs a valid key.

## v0.2 opt-in native checks

Prepare the pinned CPU runtime and evaluation JFK/model cache before the ASR test. Actual audio checks use real Windows devices and play eight seconds of synthetic speech. Model-manager checks download the official 667 MiB model, cancel an initial attempt, install/load it, then remove it in an isolated fixture.

```powershell
pnpm build:asr
node scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --lib native_stream_resamples_finalizes_and_reports_worker_crash -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --test native_audio -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --lib official_model_download_cancel_install_and_remove -- --ignored --nocapture
```

See [release validation](../../docs/releases/v0.2.0.md) and [benchmark evidence](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/docs/testing/local-stt-benchmark-v0.2.md) for outcomes and scope. No isolated test modifies real provider targets or sends lecture content to a cloud provider.
