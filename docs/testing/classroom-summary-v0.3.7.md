# Classroom outline and segmented summaries — 0.3.7

Date: 2026-10-05. Local candidate; no paid cloud calls.

## Caption timing carried forward

The [0.3.6 MIT OCW tests](local-caption-latency-v0.3.6.md) observed first English at 2.1–2.3 seconds, first provisional Chinese at approximately 16 seconds and first persisted Chinese at approximately 24 seconds. This includes model cold loading. Once ready, final English to saved Chinese had medians around 2–3 seconds. These clocks start at audio playback, not an independently annotated first spoken phoneme. They are not per-word latency measurements or universal notebook guarantees. Waiting for a stable source or sentence finalization adds time before the final-English clock begins.

No caption worker or translation scheduling was changed in 0.3.7. Its summary work runs after class through the existing exclusive post-class job mechanism.

## Source and persistence regression

- 130 finalized source segments (more than the live caption window) produce 17 ordered sections. Concatenation preserves every timestamped source line, including the tail and fractional bounds. Translation excerpts remain available.
- An oversized Unicode segment is preserved intact for bounded model recovery, rather than dropped at the section size limit.
- Old checkpoint JSON without range fields remains readable. New ranges, completed section bodies and publication survive SQLite reopening. Publication preserves manual notes. Editing the transcript changes its source version while retaining the old summary.
- Existing cancellation, worker failure, bounded splitting and idempotent publication regressions continue to pass. These use controlled provider responses, not evidence of language-model quality.

## Interface regression

`pnpm test:components` includes `classroom-summary.mjs`. Real React components in headless Edge verify the default outline tab, all 17 sections through pagination, exact replay timestamps, duplicate-generation exclusion, visible partial results and resume, append without replacing manual text, stale-result notices and no generation action during live recording. Existing note races, captions, contrast, model controls and Chinese UI suites also pass. Component fixtures use synthetic text/state only; no synthetic speech was played.

## Native local-model check

`tests/e2e/classroom-summary-native.mjs` uses the existing 90-second real MIT OCW lecturer recording/transcript described in the caption report, in an isolated library. It launches the compiled native debug EXE with real WebView2 and generates section notes using local Qwen3.5-4B with Quiet Mode. The test checks visible Chinese output, full input coverage, playback from the section timestamp, append to the manual draft, and unchanged original transcript, manual note and recording hash. Native results are recorded in ignored `target/classroom-summary/native.json`.

Three local runs took 51.6, 64.9 and 64.1 seconds including model startup. Manual source comparison found a semantic error: a criticism of an informal definition was generalized into a criticism of folk psychology, with invented causal reasoning. Prompts now retain criticism/negation referents, prohibit added causal reasoning and favor at most five explicit key points over jokes or uncertain cut-off claims. **The repeats still included unsupported interpretation and background leakage; semantic quality has not passed acceptance.** Functional test success means generation, display and persistence worked, not that every generated claim was correct. Original source remains available for checking each section. Broader quality evaluation or a stronger study model is still needed before recommending these summaries as reliable study material.

`classroom-summary-restart.mjs` reopens the native app to check saved summaries, explicitly appends a section, waits for that exact draft in SQLite, then reopens again to verify the draft. A previous test incorrectly treated an already-existing draft as proof that the new append had saved; it now checks the exact new content. Explicit append also bypasses the typing debounce and queues a database save immediately.

This short sample has one source section. Multi-section persistence and recovery are covered by deterministic regressions; model quality across a full class and live multi-model performance are not established by this check. Neither a new 90-minute soak nor an ordinary laptop power/noise test is claimed.

## Build and installation

65 desktop unit tests plus one environment test passed; the 11 opt-in desktop tests and two audio integration tests were not part of that ordinary run. Clippy with warnings denied, TypeScript, the complete component suite, a final summary/note race rerun, formatting and repository checks passed. No synthetic audio was played.

The 0.3.7 NSIS installer was built and upgraded the stable local installation. Installed runtime payload, icons and version were verified, and the user's database SHA-256 remained unchanged. The native summary checks above used the isolated debug EXE, not the installed release EXE; installer verification does not add a claim of a complete installed GUI/audio soak.

- Installer: `LectureRelay_0.3.7_x64-setup.exe`, 16,217,252 bytes.
- SHA-256: `4A2F74A0A303BCF56E2B15CF37A3FB400054536A29966D973197FC580B3596FA`.
- Installation evidence: ignored `target/classroom-summary/installer-result.json`.
