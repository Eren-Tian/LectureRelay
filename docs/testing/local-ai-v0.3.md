# Local AI preview evaluation — 2026-10-02

## Scope

LectureRelay 0.3.0 separates local English speech, translation, and study tasks. Nemotron remains the speech model; Hy-MT2-1.8B Q4_K_M is the initial translation candidate; Qwen3.5-4B Q4_K_M (Unsloth conversion) supplies summaries, user-directed whole-class review and Q&A, and is an alternative translator. All model revisions, sizes and SHA-256 values are fixed in the catalog. Neither text model is certified as a best default.

Tests used an Intel i9-13900KF (24 cores / 32 logical CPUs), about 63.8 GiB RAM, Windows x64, and CPU inference. The installed GPU was not used. There were no paid/authenticated cloud calls. Synthetic text, non-sensitive speech and isolated libraries were used; the personal classroom database was not used for inference tests.

## Actual models and quality

[Raw comparison](../../experiments/local-ai/reports/2026-10-02/translation-comparison.json) contains four English source cases (concurrency, quantities, causality and derivatives), three target languages and two local models: 24 responses. Hy-MT2's 11 warm requests had a 1,342 ms median (817–2,037 ms); Qwen's had a 3,323 ms median (2,085–4,212 ms). The first cold requests took 3,049 and 6,517 ms respectively. These release-mode native measurements used full performance, one request at a time, without concurrent transcription. They are not microphone-to-screen latency or a statistical benchmark.

Observed problems include Hy-MT2 rendering Japanese “null hypothesis” as “空の仮説” and “second derivative” as “二番目の導数”; a Korean derivative response changed “neither” into the possibility of “both.” A Korean concurrency response mixed Japanese characters into the mutex term. That particular glossary supplied three languages together, which is an additional confound; real courses should supply terms in the course's target language. Qwen performed better on these few cases but the set is too small for a quality ranking. Numerical values 0.25, 0.05 and 20% were retained in the tested numbers case.

[Summary/review smoke evidence](../../experiments/local-ai/reports/2026-10-02/smoke.json) records three synthetic transcript excerpts with timestamps up to 88:20. Translation took 5,638 ms including cold loading; review took 46,022 ms. The late ATP example appeared in the review, notes were saved separately and original transcript text remained. This is **not 90 minutes of transcript or a 90-minute run**. Qwen also made a substantive error: it interpreted “At the end of class: use random assignment…” as performing random assignment at the end of an experiment. Timestamp references are aids to checking, not proof of correctness.

[Independent Bergamot results](../../experiments/local-ai/reports/2026-10-02/bergamot-comparison.json) use upstream `fxtranslate 0.4.2` and Mozilla Remote Settings, with separate caches. Four EN→ZH requests took 102–209 ms and four EN→JA requests 106–200 ms, but technical vocabulary and negation were unreliable (including “race condition” becoming “比赛条件” / “人種条件”). The Korean model failed in the engine with a slice-range panic and produced no usable result. This baseline has no glossary/context prompt support, so it is not an equal-input model ranking. Bergamot is not bundled. No CourseDude runtime, wrapper or private service is distributed.

## Real runtime and application checks

- Real local download: cancel after receiving data, remove the partial, download Hy-MT2 again, verify its expected SHA-256/license/manifest, and remove it without removing Qwen. Passed.
- Actual worker: four-thread Quiet Mode, a shared CPU affinity mask, hot affinity changes, unauthenticated request rejection (401), killed-worker failure, process cleanup and cancellation. Passed. [Quiet-mode sample outputs](../../experiments/local-ai/reports/2026-10-02/quiet-auth.json) took 1,211 / 1,496 / 1,659 ms for ZH / JA / KO, without concurrent transcription.
- Native GUI: actual React/WebView2 with downloaded models, not a mock runtime. Ten checks passed: model roles, independent choices, Quiet Mode, real translation, summary preserving manual notes, review cancellation, user-directed review, source-linked Q&A and persistence after restart. [GUI record](../../experiments/local-ai/reports/2026-10-02/gui-results.json). This used the **debug native executable with a production frontend bundle**, a debug-only isolated data root and the portrait display; it is not installed-release GUI acceptance.

The local server binds loopback only, uses a random per-process bearer key, bypasses proxies, denies redirects and is killed with its owning process. Keys, prompts and responses are not written to runtime logs. Code and targeted failure tests support these claims; this is not an independent security audit.

### Short live GUI flow

[Live evidence](../../experiments/local-ai/reports/2026-10-02/live-results.json) covers a 50.74-second real WASAPI system-audio capture in the isolated debug WebView, with Quiet Mode on. English and Chinese captions appeared while recording continued; pause/resume, stop, replay metadata and a generating Qwen task's cancellation passed. Cancellation returned in 713 ms. Audio was saved 127 ms after clicking stop and remaining AI processing finished after 1,870 ms. Three final segments were saved. A previous attempt ended at 17.63 seconds because the user pressed Stop; it is not counted as a product failure or completed acceptance.

Cold-start first translation appeared at 43,786 ms. This includes speech-model loading, speech segment finalization, text-model integrity checking/loading, inference and polling; it does not isolate translation latency. Debug SHA checking is slower than release, but this result still does **not** establish acceptable live latency. The final measured speech backlog was 0.71 seconds and translation queue was empty; fifty seconds cannot establish long-term queue stability.

The process group (app, WebView2, speech and translation children; excluding driver/player) had a sampled peak RSS sum of 3,866 MiB and private-memory sum of 5,525 MiB. Mean CPU was 8.60% of 32 logical CPUs, peak 13.44%, sampled every two seconds. RSS sums may double-count shared pages. One startup dropped/discontinuous-audio buffer was reported; the 50.74-second WAV loaded without a playback error, which does not certify every audio sample. These debug-build measurements are not installer performance or low-power-laptop acceptance.

## Resource and failure behavior

Quiet Mode applies one shared four-logical-CPU affinity mask to speech and text workers. Turning it off restores the app's available CPU mask; a text worker refreshes its thread pool on the next request. Workers are released when their task ends or is cancelled. Recording is independent of AI failures, final English is saved before translation, and bounded translation queues retain untranslated English for retry. Study jobs wait until recording and live processing finish. After stopping, saved-audio status and remaining AI work are displayed separately.

Whole-class review processes all transcript sections in bounded chunks, reduces section drafts for an overview, and retains the section drafts rather than silently cutting off the last part of a long lecture. Q&A retrieves selected excerpts and remains a separate mode. Very large outputs or context overflow fail explicitly. There is no automatic cloud fallback.

## Outstanding acceptance

Packaging completed with a successful isolated NSIS installation, matching runtime/license hashes and unchanged personal-database hash. See [installer evidence and checksum](../releases/v0.3.0.md). Normal tests: 31 desktop and one environment test passed; nine opt-in desktop tests and the native audio hardware test remain ignored in the normal suite. The specific real-model checks listed above were invoked separately and passed.

Ordinary-laptop latency, fan noise, power consumption and a new 90-minute full-app run with real local translation remain unverified. A previous v0.2 installed-app soak found WebView2 memory growth; this change does not establish that it is resolved. No authenticated cloud acceptance was run. Model quality needs a larger classroom corpus, language-specific review and measured term/number/negation errors before promoting any candidate to a quality recommendation.

Reproduction: [local AI experiments](../../experiments/local-ai/README.md), [validation tiers](validation.md), [user setup](../user-guide/local-ai.md).
