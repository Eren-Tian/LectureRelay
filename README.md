# LectureRelay

LectureRelay **0.2.0** is a Windows classroom companion: course context and glossary, microphone or system recording, live English captions, optional translation, lecture replay, corrections, notes, evidence-based Q&A and exports.

Built with Tauri 2, React, TypeScript, Rust, SQLite and a controlled native Nemotron speech worker. Recording and manual work are offline; local recognition needs a one-time model download. Cloud processing uses your own OpenAI/Groq key. Defaults are **None**, with no automatic cloud fallback.

The [October 2 preferences update](docs/releases/v0.2.0-preferences.md) adds persistent Light/Dark themes, a global Quiet Mode switch that updates running workers, five-second audio input checks, replay speed/skip controls and transcript search. Installed acceptance verified the same worker switching from four to 32 and back to four allowed logical CPUs during a recording.

The [October product iteration](docs/releases/v0.2.0-product-iteration.md) adds categorized Settings, clearer bilingual caption states, stable reading/scrolling and an original flying phoenix. Its short installed-app run checks the revised classroom at 1180×780 and 880×620. An earlier build passed a real 90-minute installed local recording/caption/replay/restart run; that run found continuing WebView2 memory growth, which this UI iteration does not claim to resolve. Authenticated cloud workflows and ordinary-laptop behavior remain unverified. This is an unsigned development preview. See the [earlier installed acceptance](docs/testing/installed-acceptance-v0.2.md), [v0.2 validation](docs/releases/v0.2.0.md) and [cleanup report](docs/releases/v0.2.0-repository-cleanup.md).

## Develop

Windows x64, Node 24.15.x, pnpm 11.25.0, Rust 1.98.1 MSVC, C++ Build Tools/Windows SDK and WebView2 are required. End users need only the installer and WebView2.

```powershell
pnpm run setup
pnpm run doctor
pnpm dev
```

The first build downloads a hash-pinned CPU SDK; model weights are downloaded separately in the app. Python is only for opt-in experiments/soak tests. Details: [environment](docs/development/environment.md), [contributing](CONTRIBUTING.md).

| Command                                       | Purpose                                            |
| --------------------------------------------- | -------------------------------------------------- |
| `pnpm dev:web`                                | Frontend preview; native APIs need Tauri           |
| `pnpm check:web`, `pnpm build:web`            | Type check and frontend production build           |
| `pnpm test:rust`, `pnpm lint:rust`            | Normal tests and Clippy with warnings denied       |
| `pnpm format:check`, `pnpm format:rust:check` | Formatting checks                                  |
| `pnpm verify:repo`, `pnpm verify:resources`   | Imports/links/secret hygiene and runtime staging   |
| `pnpm build:debug`                            | Native debug executable                            |
| `pnpm release`                                | Release EXE + current-user English NSIS + checksum |

Installer: `target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_0.2.0_x64-setup.exe`.

## Repository

```text
apps/desktop/src/             app shell, feature UI, shared UI/hooks/types
apps/desktop/src-tauri/src/   native app, audio, database, speech, providers, security
apps/desktop/native/         production C++ speech-worker source and runtime manifest
assets/branding/             canonical phoenix SVG
scripts/                    dev, build, test, release and verification
experiments/local-stt/       development-only model comparisons and preserved reports
tests/                      fixture policy and opt-in long soak
docs/                       architecture, providers, security, user guides and releases
target/                     ignored builds, SDKs, fixtures, experiment downloads and installers
```

The [repository map](docs/architecture/repository-structure.md) explains boundaries. Start with [classroom use](docs/user-guide/getting-started.md), [local speech](docs/user-guide/local-speech.md), [provider setup](docs/providers/setup.md), [architecture](docs/architecture/overview.md) and [tests](docs/testing/validation.md).

## Data and security

SQLite, models, checkpoints and app state live in `%LOCALAPPDATA%/LectureRelay/`. Recordings and sidecars live in the Windows Documents Known Folder under `LectureRelay/Courses/`; exports under `LectureRelay/Exports/`. These locations are independent of source/build/install directories. Schema 1→2 migration, Trash/restore and uninstall preserve user content. Back up database and library together after exiting.

API keys belong only in the app password field and Windows Credential Manager (`LectureRelay/provider/{openai,groq}`), never `.env`, SQLite, logs or exports. Read [security](SECURITY.md) and [native licenses/provenance](docs/licenses/native-runtime.md). Signing, a project-wide source license and a private security contact remain release tasks.
