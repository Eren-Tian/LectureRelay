# LectureRelay

LectureRelay is a **Windows desktop app** for recording classes, reading English captions and reviewing what you learned. **Download the EXE, install it, and open the app. You do not need to build the project or install developer tools.**

## Download and install

**[Download LectureRelay 0.2.0 for Windows x64 (.exe)](https://github.com/Ellen-Tian/LectureRelay/releases/download/v0.2.0/LectureRelay_0.2.0_x64-setup.exe)**

[Release notes and all downloads](https://github.com/Ellen-Tian/LectureRelay/releases/tag/v0.2.0) · [SHA-256 checksum](https://github.com/Ellen-Tian/LectureRelay/releases/download/v0.2.0/LectureRelay_0.2.0_x64-setup.exe.sha256)

1. Download **`LectureRelay_0.2.0_x64-setup.exe`** from the release's **Assets** section. The automatically generated **Source code** archives are for developers.
2. Run the installer and follow the setup wizard. It installs for your Windows user and downloads Microsoft WebView2 if it is missing; that step needs an internet connection.
3. Open **LectureRelay** from the Start menu or desktop shortcut. No LectureRelay account is required.
4. For local English captions, open **Settings → Local AI**, download the speech model once (about 667 MiB), then select **Local English** in **AI Providers**.
5. Create a course, add its background and terminology, select your microphone or system audio, and start a class.

This package targets **64-bit Intel/AMD Windows PCs**. A GPU is not required. The speech model is downloaded separately. You do not need Node.js, pnpm, Rust or Python to use the installed app.

This is an **unsigned development preview**; Windows may display an unknown-publisher warning. GitHub downloads currently require access to this private repository; that is separate from using the app, which has no mandatory login.

## What you can do

- Organize courses with background information and a terminology glossary.
- Record a microphone or system audio, with local English speech recognition.
- Read live captions, scroll back, jump to live, pause and resume.
- Replay recordings, follow timestamps, search and correct transcripts.
- Import supported media, attach PDF slides, and keep timestamped notes, bookmarks and chapters.
- Review note versions and unfinished processing tasks, and export transcripts, subtitles and notes.
- Choose Light or Dark appearance and a global Quiet Mode for local speech.
- Restore courses from Trash and keep your library between app sessions.

See the [getting-started guide](docs/user-guide/getting-started.md) and [local speech guide](docs/user-guide/local-speech.md).

## Local and optional cloud AI

**Local English transcription runs on your computer with no per-minute speech API charge.** After the model download, recording, local captions, playback and manual notes can work offline. Quiet Mode limits local speech's CPU budget; actual speed, power use and fan noise depend on your computer.

**Translation, AI-generated notes and Q&A currently use an optional OpenAI/Groq provider configured with your own API key.** Provider charges or usage limits apply to your account. Cloud providers are disabled by default, and there is no automatic cloud fallback.

Offline translation and local AI summaries are being evaluated; they are **not included in this release**. Read [provider setup](docs/providers/setup.md) before enabling cloud processing.

## Preview status

Version 0.2.0 includes the classroom, appearance and study-workspace changes. The GitHub installer is rebuilt from the published source; its release page records the packaging checks and checksum.

Authenticated cloud workflows and ordinary-laptop power/noise behavior remain unverified. A previous 90-minute installed-app run found WebView2 memory growth; this release does not claim that issue is resolved. Earlier reports describe the specific builds and scenarios tested, rather than certifying every feature in the current installer: [installed acceptance](docs/testing/installed-acceptance-v0.2.md), [preferences](docs/releases/v0.2.0-preferences.md), [product iteration](docs/releases/v0.2.0-product-iteration.md).

## For developers

The instructions below are only for contributing or building from source. **They are not part of installing or using LectureRelay.**

The app uses Tauri 2, React, TypeScript, Rust, SQLite and a native Nemotron speech worker. Development requires Windows x64, Node 24.15.x, pnpm 11.25.0, Rust 1.98.1 MSVC, C++ Build Tools/Windows SDK and WebView2.

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

Build output: `target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_0.2.0_x64-setup.exe`. Publish the installer and checksum as GitHub Release assets; build output is excluded from Git.

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
