# Local text AI experiments

These are opt-in developer checks, not dependencies users install. The application downloads weights itself and includes its CPU runtime in the Windows installer.

The fixed catalog is in `apps/desktop/src-tauri/src/models/catalog.rs`. For the native experiments, download the two catalog files from their pinned Hugging Face revisions into `target/local-ai-evaluation/models/` and verify the catalog SHA-256 values. Never use CourseDude resources. Prepare the runtime with `pnpm build:text`.

```powershell
node scripts/dev/run-native.mjs cargo test --release --locked --lib classroom_translation_comparison -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test --release --locked --lib local_ai_translation_summary_review_and_cancel -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test --release --locked --lib local_worker_quiet_budget_auth_crash_and_cleanup -- --ignored --nocapture
node scripts/dev/run-native.mjs cargo test --release --locked --lib local_text_download_cancel_verify_and_remove -- --ignored --nocapture
```

The final check downloads roughly 1.1 GB again. All tests allocate isolated UUID libraries. Synthetic outputs go to `target/local-ai-evaluation/`; selected evidence is preserved in [reports/2026-10-02](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/experiments/local-ai/reports/2026-10-02/translation-comparison.json).

For the independent Mozilla baseline, install `fxtranslate==0.4.2` into `target/local-ai-evaluation/bergamot-package` using Python's `pip --target`, then run `python -X utf8 experiments/local-ai/benchmark-bergamot.py`. It uses Mozilla model discovery and an isolated cache, with no application integration. This engine does not accept the contextual/glossary prompts used by the two language models, so the four shared source sentences are a diagnostic comparison, not a controlled quality ranking.

The native WebView checks used for the 0.3 evaluation (`tests/e2e/local-ai.mjs` and `local-ai-live.mjs`) were one-off acceptance scripts; they remain in the [repository history](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/tests/e2e/local-ai.mjs).

See [results and limits](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/docs/testing/local-ai-v0.3.md). Do not infer installed-release GUI, cloud, laptop, or 90-minute endurance acceptance from these checks.
