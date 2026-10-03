# Architecture and storage — v0.2.0

React owns presentation and typed Tauri IPC. Rust owns paths, storage, WASAPI/CPAL capture, credentials, background work and provider abstractions. React receives partial text, final segments, timestamps/status rather than invoking model APIs. A controlled native C++ process implements local STT.

## Authoritative recording

The callback converts microphone or render-loopback samples to mono PCM16 through a bounded 64-buffer channel. A dedicated writer stores native-rate WAV independently of speech/translation. WAV headers and recovery checkpoints synchronize about every second. Pause gates samples and excludes paused time. Recoverable WASAPI discontinuities warn instead of terminating capture; device/disk errors preserve prior audio.

Stop closes the stream, drains captured audio and finalizes WAV. Startup marks unfinished rows interrupted and recovers valid checkpointed duration. One exclusive Windows file handle permits one app per data root. Recovery can lose samples after the latest checkpoint; it cannot protect against disk failure or power loss.

## Live processing

Speech tails checkpointed WAV in two-second pieces. The local worker retains genuine streaming state and feeds 160 ms engine blocks. Provisional hypotheses can change; finals occur at a quiet boundary, a 20-second cap or Stop. The simple silence rule is not a trained VAD. UI timestamps are coarse audio spans; native word offsets are not exposed.

Cloud speech uses rolling WAV requests, a 15-second live timeout and up to three consecutive failures with a two-second retry wait. Translation consumes finals separately through an eight-batch queue and a 20-second request timeout. Overflow/failure preserves English/audio for post-class processing. Notes/Q&A are blocked during recording.

Live IPC contains only 200 recent finals and one draft; all older finals remain in SQLite. Slow inference creates a disk-backed backlog. Backlog over 12 seconds warns and Stop can leave unsaved tail audio for later STT. Local failure ends captions while recording continues. There is no automatic cloud fallback.

Post-class adapters commit per chunk and resume unsaved audio: local chunks at most 30 seconds, cloud chunks at most 60 seconds. There is no separate Parakeet refinement or automatic replacement of a complete live transcript.

## Native boundary and model manager

The hidden worker loads NeMo-Speech.cpp 0.1.0 via C API. Binary messages, Rust writer/reader channels and replies are bounded, with a 30-second timeout. Restricted DLL search paths and a kill-on-close Windows Job Object contain the process. Global Quiet Mode limits CPU affinity to at most four available logical processors; disabling it restores the full CPU mask. The parent updates registered worker handles immediately, including during live recording. This does not guarantee four software threads or low fan noise.

The global manager downloads a pinned official revision, verifies size/SHA-256, records revision/runtime metadata and copies license/notice files. Download/removal is blocked by recording, live work and exclusive jobs. Installed status validates manifest and file length, without rehashing weights on each launch.

## Storage

`001_initial.sql` remains the base; transactional `002_classroom.sql` sets `user_version=2`. New fields and serde settings have compatible defaults.

| Entity                   | Behavior                                                                |
| ------------------------ | ----------------------------------------------------------------------- |
| Courses                  | `deleted_at` soft deletion and Trash restore                            |
| Lectures                 | Audio source and persistent STT cursor                                  |
| Segments                 | Stable IDs, provider/status/transcript version                          |
| Transcript edits         | Trigger preserves prior text/translation/provider/version on correction |
| Local models             | One global revision/hash/size/runtime registry                          |
| Notes, glossary, answers | Existing local data/reference snapshots preserved                       |
| Settings                 | Independent speech/text providers and caption preferences; no keys      |

Only final live segments persist. Inserts are idempotent and the cursor is monotonic. Provenance uses `live`, `postclass` and legacy `original`; a version/history browser remains future work.

```text
%LOCALAPPDATA%/LectureRelay/
  app.db, app.db-wal, app.db-shm
  models/                 GGUF, manifest and model license/notice
  state/webview2/          browser state; instance.lock gates launches
  recovery/               recording checkpoints
  logs/                   bounded performance JSON per lecture
  cache/, temp/

<Windows Documents Known Folder>/LectureRelay/
  Courses/<course>/<lecture>/recording.wav, metadata.json, transcript.json, notes.md
  Exports/

Windows Credential Manager: LectureRelay/provider/{openai,groq}
```

SQLite is authoritative. Sidecar failure after a commit is surfaced without undoing the database. Backup database/library together after exiting. Uninstall retains user data. Sync, encryption, library relocation, permanent trash purge and sidecar import are absent.

## Observability and limits

Five-second CPU/RAM samples cover Rust plus native STT, excluding WebView2/GPU. Content-free diagnostics also track STT/translation timings, drops and backlog; one JSON per lecture is overwritten about every 30 seconds and at Stop. Production uses Windows Known Folders and a restrictive CSP; only debug builds honor `LECTURERELAY_TEST_ROOT`. Raw HTML is disabled in Markdown. See the [release report](../releases/v0.2.0.md) for measured scope and pending acceptance.
