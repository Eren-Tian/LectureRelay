# Architecture and storage

This describes the current code. When behavior here changes, update this page in the same change.

React owns presentation and calls typed Tauri commands (`apps/desktop/src/api/client.ts`). Rust owns paths, storage, audio capture, credentials, background work and provider adapters. React never calls model or cloud APIs; it receives partial text, final segments, timestamps and status. Two controlled native child processes do local inference: the C++ speech worker (Nemotron through NeMo-Speech.cpp) and `llama-server` (llama.cpp) for local text models.

## Recording is authoritative

`audio/capture.rs` converts microphone or render-loopback samples to mono PCM16. The callback hands packets to a bounded channel (8,192 packets plus a separate sample budget, so memory is bounded by time). A dedicated writer in `audio/recording.rs` stores native-rate WAV independently of captions, translation and summaries. WAV headers and recovery checkpoints are synchronized about every second. Pause gates samples and excludes paused time. Recoverable WASAPI discontinuities produce warnings instead of ending capture; device or disk errors keep the audio already written.

Stop closes the stream, drains captured audio and finalizes the WAV. On startup, unfinished lectures become `interrupted` and recover their checkpointed duration. An exclusive file handle allows one app per data root. Recovery can lose samples after the latest checkpoint; it cannot protect against disk failure or power loss.

## Live captions

`speech/streaming.rs` starts one live session per recording and publishes `LiveStatus` events. A session has two parts that never block recording:

- **Recognition** (`speech/recognition.rs`) tails the checkpointed WAV. The local engine receives 0.32-second steps (two 160 ms native blocks) and keeps genuine streaming state; partial text can change until a final, which the worker emits after 500 ms of quiet, at a 20-second cap, or on Stop. Cloud speech sends rolling 2-second WAV requests with a 15-second timeout, skips near-silent chunks, and stops after three consecutive failures with a 2-second wait between attempts. A local failure ends captions while recording continues. There is no automatic cloud fallback. Finals are saved idempotently with a monotonic cursor (`transcribed_until`).
- **Translation** (`speech/translation_worker.rs`) consumes finals through `TranslationQueue` (`speech/live_translation.rs`): one replaceable preview and at most two final batches, the newest winning when overloaded. Requests time out after 30 seconds locally and 20 seconds in the cloud. Work is skipped while translation is paused, when it is more than 16 seconds old, or when recognition is more than 6 seconds behind. Previews of unstable local text run only for local speech with local translation and yield to final work. Anything skipped keeps its English for postclass translation.

Live events carry the latest 200 finals and one draft; older finals stay in SQLite. Slow inference creates a disk-backed backlog. More than 12 seconds of backlog shows a warning, and Stop then leaves the remaining audio for postclass transcription. Simple silence detection is not a trained VAD, and caption timestamps are coarse audio spans.

## Live summaries

`app/live_summaries.rs` checks an active recording every two seconds and summarizes newly finalized English every 2, 4 or 5 minutes, or on request. Summaries run only through Groq or OpenAI with the user's key, after explicit upload consent and a successful connection test. Work is single-flight and never holds the recording gate during inference. A rate-limited provider is cooled down for its `retry-after` period. Each card stores a snapshot of its source segments with their revisions, so changed or deleted sources mark a card stale instead of silently changing it. Cards that were running when the app closed become `deferred` on startup.

## Postclass work

Transcription, translation, notes, review, questions, media import and provider tests run as exclusive jobs (`app/jobs.rs`) recorded in `processing_tasks`; tasks running at exit become `interrupted`. Postclass adapters commit per chunk and resume unsaved audio. Local text work starts `llama-server` on a loopback port with a per-launch token passed through the environment. Both native workers run in a kill-on-close Windows Job Object.

## Concurrency

State-changing commands take one short gate (`AppState::lock_gate`). The gate guards no data, so a poisoned lock is recovered instead of blocking the app. While holding it, a command calls `AppState::ensure_idle(Operation)` (`app/busy.rs`). That file is the single table of which running work (recording, live captions, a job, a live summary, a model download, the audio test) blocks each operation, with one message per kind of work. Course-specific checks, such as recording in the course being moved to Trash, stay in the command.

## Settings and domain values

Serialized values live in `src-tauri/src/domain.rs` and `apps/desktop/src/types/domain.ts`. Closed choices (theme, providers, processing modes, audio sources, lecture status and source, segment origin) are Rust enums whose wire strings match the TypeScript unions, so stored data is unchanged. A stored choice this version does not know falls back to its default instead of failing every settings read. A legacy or unknown live-summary provider is turned off at startup and on every read, never redirected to a cloud provider. Theme and Quiet Mode save immediately and independently of other preferences, including during recording.

## Messages and localization

Rust reports English. `apps/desktop/src/i18n/native-messages.ts` maps it to Simplified Chinese: exact messages, `format!` templates with `{}` values, and a small external section for browser and PDF.js errors. Interface text lives in `i18n/zh-CN.ts` with a matching `i18n/en.ts`. `pnpm verify:repo` fails when a Rust message has no translation, a translation is no longer emitted, Chinese appears in Rust or component code outside the catalogs, or a UI key is unused. Model prompts and native dialog text are marked `// i18n-exempt`.

## Native boundary and model manager

The speech worker loads NeMo-Speech.cpp through its C API with DLL search restricted to its runtime and Windows system directories. Binary messages and replies are bounded, with a 30-second timeout. Global Quiet Mode limits CPU affinity to at most four available logical processors for all local workers; turning it off restores the full mask. The parent updates running workers immediately. This does not guarantee four software threads or low fan noise.

The model manager downloads pinned official revisions, verifies size and SHA-256, records revision and runtime metadata and copies license and notice files. Installed status validates the manifest and file length without rehashing weights at every launch.

## Storage

SQLite is authoritative. Migrations under `database/migrations/` are explicit, transactional and sequential; the current schema is `user_version=5` (`001_initial` through `005_live_summaries`). Databases newer than the app are rejected.

| Entity                    | Behavior                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| Courses                   | Soft deletion with Trash restore; confirmed permanent deletion        |
| Lectures                  | Status, audio source and persistent transcription cursor              |
| Segments                  | Stable IDs, origin, provider, status, transcript version and revision |
| Transcript edits          | Trigger keeps the previous text, translation, provider and version    |
| Notes, versions, answers  | Manual notes and saved AI versions are separate                       |
| Study marks, documents    | Timestamped bookmarks and chapters; course PDFs                       |
| Reviews, processing tasks | Resumable review checkpoints; job history                             |
| Live summary cards        | Source snapshots, provider, model, state and message                  |
| Local models              | One global revision, hash, size and runtime registry                  |
| Settings                  | Typed preferences in `app_settings`; no keys                          |

```text
%LOCALAPPDATA%/LectureRelay/
  app.db, app.db-wal, app.db-shm
  models/                 GGUF, manifest and model license/notice
  state/webview2/         browser state; instance.lock gates launches
  recovery/               recording checkpoints
  logs/                   bounded performance JSON per lecture
  cache/, temp/

<Windows Documents Known Folder>/LectureRelay/
  Courses/<course>/<lecture>/recording.wav, metadata.json, transcript.json, notes.md
  Courses/<course>/Documents/  attached PDFs
  Exports/

Windows Credential Manager: LectureRelay/provider/{openai,groq}
```

Sidecar files are snapshots. A sidecar failure after a commit is reported without undoing the database. Back up the database and library together after exiting. Uninstall keeps user data. Sync, encryption and library relocation are not implemented.

## Observability and limits

Five-second CPU/RAM samples cover the Rust process and the native speech worker, not WebView2 or GPU. Content-free diagnostics also record speech and translation timings, drops and backlog in `logs/<lecture>-performance.json`, rewritten about every 30 seconds and at Stop. `LECTURERELAY_TRACE_CAPTIONS=1` additionally writes timestamp-only caption stages. Production uses Windows Known Folders and a restrictive CSP; only debug builds honor `LECTURERELAY_TEST_ROOT`. Raw HTML is disabled in Markdown. See [security](../security/overview.md) for credential and endpoint policy.
