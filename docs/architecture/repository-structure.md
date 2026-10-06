# Repository structure

```text
apps/desktop/
  src/
    app/                     shell, routes and workspace context
    features/                courses, glossary, live-lecture, lecture-history,
                             transcript, notes, qa, model-manager, ai-providers,
                             trash, library, study, settings
    api/                     typed Tauri client
    types/                   serialized domain/IPC contracts
    components/              shared Icon, Modal, Markdown and resource-state UI
    hooks/                   shared async action/resource hooks
    lib/, styles/             presentation helpers, shared theme and layout CSS
    i18n/                    zh-CN UI catalog (runtime), matching English catalog,
                             native English→Chinese message catalog
  src-tauri/
    src/
      app/                   startup/state, busy-work policies (busy.rs), exclusive
                             jobs, post-class assistance, live summaries
      commands/              IPC validation and cross-domain concurrency gates
      audio/                 capture/device callback, recording writer, WAV encoding
      database/              connection/version gate, repositories, row mappings,
        migrations/          immutable, sequential SQL migrations
      domain.rs              canonical Rust serialized learning/settings values
      speech/                live session (streaming.rs), recognition loop,
                             live translation worker and queue
        local/               Nemotron worker IPC/containment and batch adapter
      providers/             contracts, shared official adapter and safe HTTP responses
      models/                pinned download/install/remove manager
      security/              Windows credentials and official endpoint policy
      storage/               Known Folder paths, atomic snapshots and recovery
      diagnostics.rs         content-free process CPU/RAM monitoring
      tests/                 internal integration tests and ignored acceptance fixtures
    tests/                   opt-in native audio and Windows test manifest
    resources/local-asr/,
    resources/local-text/    ignored generated runtime staging for Tauri/NSIS
    icons/, capabilities/    required platform assets and IPC permissions
  native/speech-worker/      C++ source, audited DLL manifest and build/protocol notes
assets/branding/phoenix/     canonical original SVG; generated copies are documented
crates/environment-check/   bundled SQLite/toolchain smoke check
experiments/local-stt/      isolated model comparison scripts and worker-policy snapshot
tests/fixtures/, soak/      fixture policy and long native/WAV/SQLite harness
tests/e2e/                  React component regressions, opt-in installed acceptance
apps/desktop/tests/fixtures/ isolated React views with synthetic native replies
scripts/dev/                setup, activation, doctor, native command launcher
scripts/build/              pinned SDK preparation, worker build, branding staging
scripts/test/               component driver/runner and opt-in native checks
scripts/ci/                 isolated CI capture and cold installer provenance
scripts/release/            NSIS/release wrapper and installer checksum
scripts/verification/       source hygiene/import/link audit, UI string and native
                            message catalogs, staged/installed resources
docs/                       requirements, architecture, ADRs, providers, security,
                            testing, user-guide, releases, development and licenses
```

## Boundaries

| Location           | Belongs here                                                                                        | Keep elsewhere                                          |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Frontend features  | Product views, feature form/panel state                                                             | Generic UI in components; credentials/HTTP in Rust      |
| Frontend app       | Route selection, shared workspace/confirmation orchestration                                        | SQL, model engines, feature-specific controls           |
| Native commands    | Input checks; take the gate and name their `Operation` for the busy-work table in `app/busy.rs`     | Queries, HTTP implementation, secret persistence        |
| Audio              | CPAL microphone/render loopback, levels, bounded callback, native-rate WAV, checkpoint/pause writer | STT resampling/protocol in speech/local                 |
| Database           | Connection initialization, schema transactions and domain queries                                   | File snapshots, user library and recovery orchestration |
| Speech             | Local worker protocol, batch/streaming integration, speech engine selection                         | Experimental engines or downloaded weights              |
| Providers/security | Capability contracts, compatible cloud adapter, sanitized HTTP, credential/endpoint policy          | Provider secrets or endpoints in React                  |
| Storage/models     | User paths, snapshots/recovery; separately model lifecycle                                          | Source tree reorganization of user files                |
| Experiments/tests  | Nonprivate reports, reproducible scripts, opt-in fixtures/soak                                      | Production provider path or installer                   |
| Assets/resources   | Canonical artwork and required platform copies; generated runtime staging                           | Arbitrary binaries or model weights                     |

The learning repositories keep transaction boundaries beside their queries; there is no generic transaction framework. Audio capture and recording are split by role, while pause, checkpoint, drain and timing remain together. OpenAI/Groq share their compatible implementation rather than duplicating transports.

Generated build/cache output is under `target`: `native/speech-worker` for production SDK/archive/worker, `asr-evaluation` for preserved experimental SDKs/weights/WAV/results, and UUID test roots for fixtures. `.tools`, `.pnpm-store`, `node_modules`, Vite `dist`, Tauri `gen` and `resources/local-asr` are ignored. Source PNG/ICO/PDF and migration SQL remain versionable.

Production data stays in Windows Known Folders and Credential Manager; see [storage architecture](overview.md). No unused `packages/`, empty feature folders or speculative framework abstractions are retained.

Settings use stable navigation identifiers rather than translated labels. `SettingsPage` coordinates the selected section and save action; feature panels render individual settings. `useSettingsDraft` merges independently saved runtime/summary preferences while preserving unsaved edits, and `useSettingsResources` handles model/trash reads and subscription cleanup. Keys remain in the existing native credential adapter. General preference saves also preserve authoritative runtime and summary settings in the native command.
