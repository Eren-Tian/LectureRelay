# LectureRelay

LectureRelay is a **Windows desktop app** for recording classes, reading English captions and reviewing what you learned. **Download the EXE, install it, and open the app. You do not need to build the project or install developer tools.**

## Download and install

**[Download LectureRelay 0.3.8 for Windows x64 (.exe)](https://github.com/Eren-Tian/LectureRelay/releases/download/v0.3.8/LectureRelay_0.3.8_x64-setup.exe)**

[Release notes and all downloads](https://github.com/Eren-Tian/LectureRelay/releases/tag/v0.3.8) · [SHA-256 checksum](https://github.com/Eren-Tian/LectureRelay/releases/download/v0.3.8/LectureRelay_0.3.8_x64-setup.exe.sha256)

1. Download **`LectureRelay_0.3.8_x64-setup.exe`** from the release's **Assets** section. The automatically generated **Source code** archives are for developers.
2. Run the installer and follow the setup wizard. It installs for your Windows user and downloads Microsoft WebView2 if it is missing; that step needs an internet connection.
3. Open **LectureRelay** from the Start menu or desktop shortcut. No LectureRelay account is required.
4. Open **设置 → 首次使用** for the setup checklist. Download **Nemotron** once (about 667 MiB) in **本地 AI**, then select **本地英文识别** in **AI 服务**.
5. For offline translation, download **Hy-MT2**, select local translation and enable **上课时自动翻译**. **Qwen** is optional for summaries and deep review; it can be downloaded later. Qwen is also an alternative translator.
6. Create a course, add its background and terminology, select your microphone or system audio, and start a class.

This package targets **64-bit Intel/AMD Windows PCs**. A GPU is not required. The speech model is downloaded separately. You do not need Node.js, pnpm, Rust or Python to use the installed app.

This is an **unsigned development preview**; Windows may display an unknown-publisher warning. GitHub downloads currently require access to this private repository; that is separate from using the app, which has no mandatory login.

## What you can do

- Organize courses with background information and a terminology glossary.
- Record a microphone or system audio, with local English speech recognition.
- Read live captions, scroll back, jump to live, pause and resume.
- Replay recordings, follow timestamps, search and correct transcripts.
- Import supported media, attach PDF slides, and keep timestamped notes, bookmarks and chapters.
- Review note versions and unfinished processing tasks, and export transcripts, subtitles and notes.
- Choose Light or Dark appearance and a global Quiet Mode for all local AI.
- Restore courses from Trash and keep your library between app sessions.
- Delete a single lecture, or collect timestamped classroom source sections and summarize them after recording.
- Permanently delete trashed courses or free class/model storage with explicit typed confirmation.

See the [getting-started guide](docs/user-guide/getting-started.md), [local AI guide](docs/user-guide/local-ai.md) and [0.3.8 changes](docs/releases/v0.3.8.md).

## Local and optional cloud AI

English transcription, translation, summaries and full-class review can run on your computer after model downloads. No LectureRelay login or hosted inference bill. Quiet Mode gives local AI a shared CPU budget.

- **Speech:** Nemotron Streaming EN 0.6B.
- **Translation:** Hy-MT2-1.8B Q4_K_M; optional Qwen3.5-4B alternative.
- **Summary, deep review and Q&A:** the same Qwen3.5-4B Q4_K_M download (Unsloth conversion).

Download only the models you need; all three use about 4.3 GiB of disk space. During class, speech and translation run. Study generation starts after live processing ends. Models are released when work finishes or is cancelled. See [local AI setup](docs/user-guide/local-ai.md).

These are **preview candidates**. Small classroom samples revealed terminology and negation errors; they are not certified as the best or uniformly accurate models. [Evaluation and limitations](docs/testing/local-ai-v0.3.md) distinguish real model tests from full-app and laptop acceptance.

OpenAI/Groq remain optional, with your own API key and provider charges. Local mode never automatically falls back to cloud. Read [provider setup](docs/providers/setup.md) before enabling uploads.

## Preview status

The downloadable preview is **0.3.8**, with Chinese UI, model setup feedback, caption-window close/reopen fixes, single-lecture deletion and resumable classroom outlines. During class, finalized captions are collected into timestamped source sections. After recording, local Qwen can summarize each section; generated content does not replace your manual notes. Provisional translations are never exported as completed results. See [release changes](docs/releases/v0.3.8.md), [summary validation](docs/testing/classroom-summary-v0.3.7.md) and [installed natural-speech comparisons](docs/testing/local-caption-research-v0.3.8.md).

0.3.8 short installed tests use real MIT lecturers with local models and Quiet Mode. Stable translation prefixes advance beyond 32 words, local speech updates every 320 ms, and exact digital silence avoids unnecessary encoder work. The same five-minute system-audio comparison showed an earlier Chinese course topic and reduced backlog; first English did not improve. The actual microphone fixture had substantial omissions, and translation still made meaning errors. The new 90-minute acceptance was deferred at the user's request; ordinary-laptop power/noise remains unverified.

Earlier **0.3.3** continuity acceptance completed **90m05.11s** of local speech/translation capture with synthetic probes, followed by source-audio comparison, timestamp replay, restart and original-data/preference checks. All 21,600 regular probes matched; application queue loss was zero. That evidence applies to its stated build and fixture, not to natural-speech accuracy or 0.3.8 long-session acceptance. See the [audio investigation](docs/testing/audio-continuity-v0.3.3.md) and [CI guide](docs/development/ci.md).

Authenticated cloud workflows, physical device unplug and ordinary-laptop power/noise behavior remain unverified. Device flags cannot reveal an exact upstream loss count, probe comparisons have finite resolution, and WebView memory growth and AI meaning/factual errors remain limitations. Reports apply to their stated builds and scenarios rather than certifying every feature.

## For developers

The instructions below are only for contributing or building from source. **They are not part of installing or using LectureRelay.**

To build the downloadable version, check out tag **`v0.3.8`** first; the default development branch can differ from a release.

The app uses Tauri 2, React, TypeScript, Rust, SQLite and a native Nemotron speech worker. Development requires Windows x64, Node 24.15.x, pnpm 11.25.0, Rust 1.98.1 MSVC, C++ Build Tools/Windows SDK and WebView2.

```powershell
pnpm run setup
pnpm run doctor
pnpm dev
```

The first build downloads hash-pinned CPU speech and text runtimes; model weights are downloaded separately in the app. Python is only for opt-in experiments/soak tests. Details: [environment](docs/development/environment.md), [contributing](CONTRIBUTING.md).

| Command                                       | Purpose                                            |
| --------------------------------------------- | -------------------------------------------------- |
| `pnpm dev:web`                                | Frontend preview; native APIs need Tauri           |
| `pnpm check:web`, `pnpm build:web`            | Type check and frontend production build           |
| `pnpm test:rust`, `pnpm lint:rust`            | Normal tests and Clippy with warnings denied       |
| `pnpm format:check`, `pnpm format:rust:check` | Formatting checks                                  |
| `pnpm verify:repo`, `pnpm verify:resources`   | Imports/links/secret hygiene and runtime staging   |
| `pnpm build:debug`                            | Native debug executable                            |
| `pnpm release`                                | Release EXE + current-user Chinese NSIS + checksum |

Build output: `target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_0.3.8_x64-setup.exe`. Publish the installer, checksum and build metadata as GitHub Release assets; build output is excluded from Git.

## Repository

```text
apps/desktop/src/             app shell, feature UI, shared UI/hooks/types
apps/desktop/src-tauri/src/   native app, audio, database, speech, providers, security
apps/desktop/native/         production C++ speech-worker source and runtime manifest
assets/branding/             canonical phoenix SVG
scripts/                    dev, build, test, release and verification
experiments/local-stt/       development-only model comparisons and preserved reports
experiments/local-ai/        local translation/study comparisons and preserved reports
tests/                      fixture policy and opt-in long soak
docs/                       architecture, providers, security, user guides and releases
target/                     ignored builds, SDKs, fixtures, experiment downloads and installers
```

The [repository map](docs/architecture/repository-structure.md) explains boundaries. Start with [classroom use](docs/user-guide/getting-started.md), [local speech](docs/user-guide/local-speech.md), [provider setup](docs/providers/setup.md), [architecture](docs/architecture/overview.md) and [tests](docs/testing/validation.md).

## Data and security

SQLite, models, checkpoints and app state live in `%LOCALAPPDATA%/LectureRelay/`. Recordings and sidecars live in the Windows Documents Known Folder under `LectureRelay/Courses/`; exports under `LectureRelay/Exports/`. These locations are independent of source/build/install directories. Schema 1→2 migration, Trash/restore and uninstall preserve user content. Back up database and library together after exiting.

API keys belong only in the app password field and Windows Credential Manager (`LectureRelay/provider/{openai,groq}`), never `.env`, SQLite, logs or exports. Read [security](SECURITY.md) and [native licenses/provenance](docs/licenses/native-runtime.md). Signing, a project-wide source license and a private security contact remain release tasks.
