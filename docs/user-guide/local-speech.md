# Local speech recognition

v0.2 ships one choice: **Recommended**, using Nemotron Speech Streaming EN 0.6B Q8_0 with NeMo-Speech.cpp 0.1.0. Quiet/High Accuracy are not exposed because their candidate paths have not passed acceptance.

Use **Settings → Local AI → Download**, then select **Local English** in **AI Providers → Speech recognition**. The 699,872,960-byte download (667.45 MiB) is shared across courses in `%LOCALAPPDATA%/LectureRelay/models`. Progress/cancel, model details and removal are available. Active lecture/work blocks downloads/removal; starting never downloads automatically.

Integrity uses SHA-256 `d9a01898d2a611c8764e23a1c2f45e70bbd5a425dc4de93692ac951dd603812d`, official revision `ebe59e5a817142986528bbbee5dba8db7b38ed50`. License/notice are saved beside weights. Failed/cancelled downloads are not marked installed; cancellation is checked at 250 ms intervals while network I/O is pending and retries restart the download.

Packaged C++/CPU DLLs require no Python/PyTorch/Conda/CUDA. In Settings → General, turn Quiet Mode on to use up to four available logical CPU cores, or off to allow the full CPU budget. This global preference saves immediately and also updates recognition already running. Two-second app feeds drive 160 ms engine blocks. Provisional text can change; quiet boundaries/20-second caps finalize it. UI timestamps are coarse spans.

General also offers Light and Dark appearance, saved automatically across restarts. Audio settings and the Start Lecture dialog have a five-second input test with a live level meter; it uses the selected microphone or system output without saving or uploading audio. Replay supports 0.5–2× speed, ten-second skips and English/translation search. Clear search restores the complete transcript; exports always include all segments.

Up to 64 course source glossary terms become RNNT speech contexts at boost 3. The benchmark observed no improvement; course descriptions are not free-form local ASR prompts. The same engine processes unsaved audio after Stop in 30-second batches, with no separate refinement workflow.

Failures/timeouts stop captions while capture continues; backlog remains on disk. About 943 MiB native RAM was measured in the earlier CPU benchmark; the installed 90-minute run measured a 936 MiB worker peak and continuing WebView2 memory growth. Ordinary-laptop fan/power behavior is unmeasured. Translation needs a cloud text provider/key. See the [benchmark](../testing/local-stt-benchmark-v0.2.md) and [installed acceptance](../testing/installed-acceptance-v0.2.md). Actual GUI model download/load passed. GUI cancel/removal is not verified; the native download/cancel/install/hash/load/remove workflow passed in an isolated fixture.
