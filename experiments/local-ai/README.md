# Local text AI experiments

These are opt-in developer checks, not dependencies users install. The application downloads weights itself and includes its CPU runtime in the Windows installer.

The fixed catalog is in `apps/desktop/src-tauri/src/models/catalog.rs`. For the native experiments, download the two catalog files from their pinned Hugging Face revisions into `target/local-ai-evaluation/models/` and verify the catalog SHA-256 values. Never use CourseDude resources. Prepare the runtime with `pnpm build:text`.

```powershell
node scripts/dev/run-native.mjs cargo test --release --locked --lib classroom_translation_comparison -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test --release --locked --lib local_ai_translation_summary_review_and_cancel -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test --release --locked --lib local_worker_quiet_budget_auth_crash_and_cleanup -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test --release --locked --lib local_text_download_cancel_verify_and_remove -- --ignored --nocapture
```

The final check downloads roughly 1.1 GB again. All tests allocate isolated UUID libraries. Synthetic outputs go to `target/local-ai-evaluation/`; selected evidence is preserved in [reports/2026-10-02](reports/2026-10-02/translation-comparison.json).

For the independent Mozilla baseline, install `fxtranslate==0.4.2` into `target/local-ai-evaluation/bergamot-package` using Python's `pip --target`, then run `python -X utf8 experiments/local-ai/benchmark-bergamot.py`. It uses Mozilla model discovery and an isolated cache, with no application integration. This engine does not accept the contextual/glossary prompts used by the two language models, so the four shared source sentences are a diagnostic comparison, not a controlled quality ranking.

Native WebView checks use `tests/e2e/local-ai.mjs` and `local-ai-live.mjs`, with the existing [WebDriver setup](../../tests/e2e/README.md). Set `LECTURERELAY_TEST_ROOT` to a fresh path under `target`, run the opt-in `prepare_local_ai_ui_fixture` native test, and launch the **debug application** through a driver inheriting that root. Set `LECTURERELAY_WEBDRIVER_PORT` if not using 4444. The fixture requires the catalog text weights and the existing speech evaluation model; do not point it at personal data. The live test plays non-sensitive `target/installed-acceptance/short.wav` through the default Windows output and needs an available system-audio device. The monitor layout assertion is specific to the acceptance machine's left portrait display.

See [results and limits](../../docs/testing/local-ai-v0.3.md). Do not infer installed-release GUI, cloud, laptop, or 90-minute endurance acceptance from these checks.
