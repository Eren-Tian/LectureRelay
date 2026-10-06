# LectureRelay

**English** · [简体中文](README.zh-CN.md)

LectureRelay is a **Windows desktop app** that records classes, displays English captions and translations, and helps you revisit the lesson through recordings, timestamps and notes. **Install the EXE and start using it. No LectureRelay account or developer tools are required.**

## Download and install

**[Download the latest published preview: 0.3.13 for Windows x64 (.exe)](https://github.com/Eren-Tian/LectureRelay/releases/download/v0.3.13/LectureRelay_0.3.13_x64-setup.exe)**

[Release notes and downloads](https://github.com/Eren-Tian/LectureRelay/releases/tag/v0.3.13) · [SHA-256 checksum](https://github.com/Eren-Tian/LectureRelay/releases/download/v0.3.13/LectureRelay_0.3.13_x64-setup.exe.sha256)

Upgrade by running the new installer; classroom data and downloaded models are preserved. The published package comes from a clean GitHub Windows build; its source revision, payload checks and installer hash are recorded in the release's `build-metadata.json`.

1. Download **`LectureRelay_0.3.13_x64-setup.exe`** from the release's **Assets**. The **Source code** archives are for developers.
2. Run the installer. It installs for your Windows user and downloads Microsoft WebView2 if needed, which requires internet access.
3. Open **LectureRelay** from the Start menu or desktop shortcut.
4. Open **设置 → 首次设置**. In **AI 与模型 → 本地模型**, download **Nemotron** for English captions. Add **Hy-MT2** if you want local translation, then enable the corresponding captions in the setup checklist. Models are downloaded once and shared across courses.
5. Create a course, choose Chinese, Japanese or Korean for assistance, and add course background and terminology.
6. Select **麦克风** for an in-person class or **系统声音** for a course playing on your PC. Check the input, then start recording.

This installer is for **64-bit Intel/AMD Windows PCs**. A GPU is not required. You do not need Node.js, pnpm, Rust, Python, Ollama or FFmpeg to use the installed app. Model weights are downloaded separately; local inference can then work offline.

The preview is currently unsigned, so Windows may display an unknown-publisher warning. This GitHub repository is currently private: access is needed to download its releases. The installed app itself has no mandatory login.

## Classroom workflow

- **Before class:** organize courses, add background and a terminology glossary, and choose your audio device and caption settings.
- **During class:** read English and translated captions, scroll back, return to the latest captions, and pause or resume recording. An independent caption window can be closed without stopping the class.
- **After class:** replay recordings, jump to timestamps, search and correct transcripts, fill missing translations, and export text, subtitles or notes.
- **Study:** import supported media, attach PDF slides, and keep timestamped notes, bookmarks and chapters. Generate postclass outlines, AI drafts, whole-class review guides or answers with source references. Manual notes and saved AI versions remain separate.
- **Preferences and storage:** choose Light or Dark appearance and Quiet Mode. Delete a single lecture, restore trashed courses, or permanently delete content and free class/model storage after explicit confirmation.

For a walkthrough, see [getting started](docs/user-guide/getting-started.md) and [local AI setup](docs/user-guide/local-ai.md).

Settings are grouped into six categories. **通用** contains appearance and Quiet Mode, both saved automatically. **声音与字幕** groups audio devices and caption style. **AI 与模型** groups feature selections, local model downloads and live summaries; API keys are managed in the expandable **功能设置 → 云端 API Key** panel. Other preference changes show a save bar only when needed.

## AI options

Speech, translation, postclass study and live summaries have separate settings. LectureRelay does not run a hosted inference service or supply a shared API key.

| Task                                   | Local model                             | When it runs                          |
| -------------------------------------- | --------------------------------------- | ------------------------------------- |
| English transcription                  | Nemotron Streaming EN 0.6B              | During recording                      |
| Translation                            | Hy-MT2-1.8B Q4_K_M; optional Qwen3.5-4B | During class or on request afterward  |
| Postclass summary, deep review and Q&A | Qwen3.5-4B Q4_K_M (Unsloth conversion)  | On request after live processing ends |
| Live summary cards                     | Groq or OpenAI, using your own key      | Optional, every 2, 4 or 5 minutes     |

Download only what you need: Nemotron is about **667 MiB**, Hy-MT2 **1,081 MiB**, and Qwen **2,614 MiB**; all three total about **4.3 GiB**, before recordings and app files. Local inference has no per-request API charge, but uses your computer's memory, electricity and storage.

**Quiet Mode** gives local AI a shared CPU budget. Turning it off allows use of all CPUs available to the app; practical latency, fan noise and power use depend on the computer. Local AI errors do not automatically switch processing to cloud services.

### Optional live summaries

The right-hand classroom panel can turn newly finalized English into short, timestamped cards with source references. **Groq is the preferred optional provider**, with `openai/gpt-oss-120b` as the initial model; OpenAI remains available. Summary selection does not change speech or translation settings.

**获取 Groq API Key → 粘贴并保存 → 测试总结连接 → 确认文字上传 → 启用实时总结**

Start from **设置 → AI 与模型 → 实时总结**.

Live summaries start disabled, default to every **4 minutes**, and can be set to **2 or 5 minutes**. You can also summarize the collected text manually. Cards preserve evidence and replay references; **加入我的笔记** appends them only when you choose to. Recording is saved independently of summary completion, and failed work remains visible and recoverable.

To reduce classroom resource use, live summaries run only through a cloud provider, enabled through explicit setup; postclass review and Q&A still support local Qwen.

Cloud summaries send selected English transcript sections and bounded course background/terms, not recordings. API keys are entered in the app and stored in Windows Credential Manager. Groq's free account allowance has request/token limits; OpenAI API usage is billed separately from ChatGPT subscriptions. Any charges or quotas belong to the user's provider account.

See [live summary setup](docs/user-guide/live-summaries.md) and [provider configuration](docs/providers/setup.md).

## Preview quality and validation

LectureRelay is a development preview. Transcription can omit words, translation can misread terminology or negation, and AI summaries can misrepresent the lesson. **A valid source citation is not proof that a conclusion is correct.** Keep the original text and recording available when reviewing important material.

Ordinary-laptop power/noise and physical device-unplug behavior remain unverified. The release notes of each version, such as [0.3.13](docs/releases/v0.3.13.md), record what was actually tested; [validation](docs/testing/validation.md) describes the test tiers and acceptance procedures.

## Data and privacy

- Database, model weights, checkpoints and app state: `%LOCALAPPDATA%/LectureRelay/`.
- Recordings and classroom files: the Windows Documents Known Folder, under `LectureRelay/Courses/`; exports under `LectureRelay/Exports/`.
- API keys: the application's password field and Windows Credential Manager; never put keys in chat, `.env`, test scripts, logs or exports.

Uninstalling the app preserves classroom data. Exit the app before backing up the database and library together. Local classroom files do not have application-level encryption. See [security](SECURITY.md) and [runtime licenses and provenance](docs/licenses/native-runtime.md). Windows signing and a project-wide source license remain release tasks.

## Contributing and building

These instructions are for developers. **Installing the EXE does not require them.** To reproduce a published installer, check out its release tag, such as `v0.3.13`; the default and feature branches may differ from a release.

The app uses Tauri 2, React, TypeScript, Rust, SQLite and a native speech worker. Development requires Windows x64, Node 24.15.x, pnpm 11.25.0, Rust 1.98.1 MSVC, C++ Build Tools/Windows SDK and WebView2.

```powershell
pnpm run setup
pnpm run doctor
pnpm dev
```

| Command                                       | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `pnpm dev:web`                                | Frontend preview; native APIs need Tauri    |
| `pnpm check:web`, `pnpm build:web`            | Type checking and production frontend build |
| `pnpm test:rust`, `pnpm lint:rust`            | Ordinary native tests and Clippy            |
| `pnpm test:components`                        | Isolated real React component regressions   |
| `pnpm format:check`, `pnpm format:rust:check` | Formatting                                  |
| `pnpm verify:repo`, `pnpm verify:resources`   | Repository and runtime checks               |
| `pnpm build:debug`                            | Native debug executable                     |
| `pnpm release`                                | Windows installer and checksum              |

The first build fetches pinned CPU runtimes; model weights are downloaded separately in the app. Installer output follows the configured version under `target/x86_64-pc-windows-msvc/release/bundle/nsis/`. Build output is excluded from Git and distributed through Release assets.

See [development environment](docs/development/environment.md), [contributing](CONTRIBUTING.md), [repository map](docs/architecture/repository-structure.md), [architecture](docs/architecture/overview.md) and [CI](docs/development/ci.md).
