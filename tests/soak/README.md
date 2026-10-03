# Opt-in native speech soak

`local-stt.py` is the preserved real wall-clock Nemotron/WAV/SQLite harness. It uses the experimental pre-glossary worker snapshot, synthetic/public benchmark audio and timestamped outputs under ignored `target/asr-evaluation`. It defaults to 90 minutes and is excluded from normal tests.

See [test tiers](../../docs/testing/validation.md) and [reproduction](../../experiments/local-stt/README.md). A short run checks path/migration wiring only; it does not establish long-session or full GUI acceptance. Keep the completed 90-minute evidence and failed experimental sessions in the experiment reports.
