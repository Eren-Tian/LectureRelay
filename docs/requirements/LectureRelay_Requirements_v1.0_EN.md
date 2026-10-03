# LectureRelay — Product Requirements Specification

**Document ID:** LR-REQ-001  
**Version:** 1.0  
**Status:** Requirements Baseline  
**Product:** LectureRelay  
**Primary Platform:** Windows  
**Primary Distribution:** Native Windows installer / `.exe` application  
**Initial Lecture Language:** English  
**Initial Assistance Languages:** Chinese, Japanese, Korean  
**Product Model:** Open-source, local-first, BYOK, no mandatory subscription  
**Date:** 2026-09-29

---

# 1. Purpose

LectureRelay is a Windows-first, open-source AI lecture companion designed for students attending English-taught courses.

Its purpose is not merely to transcribe speech or translate subtitles.

LectureRelay must support the complete student learning loop:

> **Hear it. Get it. Keep it.**

The product must help a student:

1. capture an English lecture,
2. understand it in real time in Chinese, Japanese, or Korean,
3. preserve the lecture recording and transcript,
4. organize the lecture by course and timeline,
5. generate course-aware notes,
6. ask questions grounded in the lecture,
7. review the material later through summaries, chapters, study guides, and quizzes.

The product must behave like a polished Windows application, not a developer demo, Python script bundle, meeting recorder, or AI wrapper.

---

# 2. Product Vision

## 2.1 Vision Statement

Build the most accessible open-source lecture companion for students studying in English as a second language.

The first release focuses on Chinese-, Japanese-, and Korean-speaking students.

---

## 2.2 Positioning

LectureRelay is:

> **An open-source AI lecture companion for international students.**

LectureRelay is not:

- a generic meeting assistant,
- a generic Whisper GUI,
- a generic translator,
- a note-taking wrapper,
- a paid API proxy,
- a cloud-first SaaS,
- a developer-only research prototype.

---

## 2.3 Brand

**Product Name:** LectureRelay

**Tagline:**

> **Hear it. Get it. Keep it.**

Supporting product statement:

> **Every lecture, in your language.**

---

# 3. Non-Negotiable Product Principles

The principles in this section are stronger than normal feature requirements.

Any implementation that violates these principles is unacceptable even if it appears to improve feature coverage.

---

# PRINCIPLE-01 — API Keys Are Secret Credentials

User API keys are treated as high-sensitivity credentials.

They must never be treated as ordinary application configuration.

## 3.1 Mandatory Rules

API keys:

- MUST remain on the user's device except when directly authenticating with the selected provider;
- MUST NOT be inserted into prompts;
- MUST NOT be included in model context;
- MUST NOT be sent to any LLM as content;
- MUST NOT be written to SQLite in plaintext;
- MUST NOT be written to JSON/YAML/TOML configuration files;
- MUST NOT appear in logs;
- MUST NOT appear in telemetry;
- MUST NOT appear in crash reports;
- MUST NOT appear in exported support bundles;
- MUST NOT be synced to Google Drive;
- MUST NOT be included in backups;
- MUST NOT be included in Git;
- MUST NOT be proxied through a LectureRelay-owned server;
- MUST NOT be printed in debug output;
- MUST NOT be exposed through frontend JavaScript longer than required for credential entry.

## 3.2 Secure Storage

On Windows, API keys MUST use an operating-system-backed secure credential mechanism such as:

- Windows Credential Manager,
- Windows DPAPI,
- another equivalent Windows-native secure storage mechanism.

The application MUST provide:

- Add key
- Replace key
- Test connection
- Remove key

The UI MUST display secrets in masked form.

Example:

```text
OpenAI
••••••••••••••••••••••••4B7Q
```

## 3.3 Allowed Network Behavior

A key may leave local secure storage only for direct authentication with the provider selected by the user.

Allowed:

```text
User PC
   ↓
Official Provider HTTPS API
```

Examples:

```text
OpenAI key → OpenAI official API
Gemini key → Google official API
Groq key   → Groq official API
```

Forbidden:

```text
User PC
   ↓
LectureRelay server
   ↓
Provider
```

LectureRelay v1 SHALL NOT operate an API proxy.

---

# PRINCIPLE-02 — Lecture Mode Must Be Quiet and Lightweight

LectureRelay is primarily used while the student is actively attending class.

Therefore resource usage, heat, battery drain, fan noise, and system responsiveness are first-class product requirements.

A feature that causes a laptop to run loudly throughout a lecture is considered a product failure.

---

## 3.4 Default Runtime Mode

The default runtime profile MUST be:

# Quiet Mode

During a lecture, Quiet Mode should run only the minimum necessary components:

```text
Audio Capture
+
Recording
+
Speech-to-Text
+
Translation
+
Caption Rendering
+
Incremental Persistence
```

The following tasks MUST NOT run continuously during class by default:

- large local LLM inference,
- study-guide generation,
- quiz generation,
- flashcard generation,
- full-lecture summarization,
- heavy embedding pipelines,
- expensive indexing,
- slide analysis,
- background model downloads,
- bulk file synchronization.

These should run after the lecture unless explicitly requested.

---

## 3.5 Runtime Profiles

LectureRelay SHOULD eventually expose:

### Quiet
Default. Lowest practical resource usage.

### Balanced
Moderate local processing.

### Maximum Accuracy
Higher resource usage allowed.

The application MUST always clearly show when a selected mode may increase battery drain or fan noise.

---

## 3.6 Resource Budget

Final production limits MUST be benchmarked on real Windows laptops.

Initial engineering targets:

### Cloud-assisted Live Mode

When STT/translation are mostly cloud-backed:

- idle CPU: near 0%;
- average application CPU during lecture: target under 10%;
- RAM: target under 700 MB excluding external model processes;
- no sustained high GPU usage;
- no sustained fan-speed increase attributable to LectureRelay on typical supported hardware.

### Local STT Quiet Mode

The system MUST:

- select an appropriate model for detected hardware;
- avoid maxing CPU/GPU continuously;
- avoid launching a large local LLM concurrently with local STT;
- reduce scheduling priority for non-critical post-processing;
- allow the user to pause background work.

Exact limits shall be established during performance validation.

---

# PRINCIPLE-03 — UI Must Be Polished, Calm, and Student-Focused

LectureRelay must look like a production consumer application.

It must not look like:

- a developer dashboard,
- a terminal frontend,
- a machine-learning control panel,
- a gaming utility,
- a dense enterprise admin portal.

The design direction is:

> **Apple-inspired simplicity, without copying Apple interfaces.**

---

## 3.7 Visual Direction

Primary palette:

### Sage Green
Used for:

- primary actions,
- selected states,
- active course identity,
- recording context,
- subtle navigation emphasis.

Accent palette:

### Muted Gold / Champagne Gold
Used sparingly for:

- important concepts,
- selected highlights,
- premium visual detail,
- logo accents,
- small status emphasis.

Base colors:

- warm white,
- ivory,
- soft light gray,
- charcoal text.

Avoid:

- neon green,
- saturated gold,
- large gradient surfaces,
- default "AI purple",
- cyberpunk visual language.

---

## 3.8 Shape and Spacing

The UI MUST use:

- rounded corners,
- generous whitespace,
- restrained shadows,
- soft borders,
- clear hierarchy,
- large primary actions,
- low visual density.

Suggested corner radius system:

```text
Small control:  10–12 px
Card:           16–20 px
Large panel:    24–28 px
```

These values are directional, not final design tokens.

---

## 3.9 Live Lecture Screen

The live lecture UI must remain intentionally minimal.

Primary visible elements:

- course name,
- recording state,
- elapsed time,
- English transcript,
- translated transcript,
- pause,
- stop,
- audio-input health.

During class, the screen SHOULD NOT prominently display:

- quiz generators,
- study dashboards,
- provider internals,
- model configuration,
- token counters,
- advanced settings.

---

# PRINCIPLE-04 — Core Functionality Must Not Require Login

LectureRelay must work locally without creating a LectureRelay account.

The core flow must remain:

```text
Install
↓
Open
↓
Choose Language
↓
Create Course
↓
Start Lecture
```

No mandatory account gate is allowed.

---

# PRINCIPLE-05 — Local-First

The primary source of truth is local data.

Courses, lectures, recordings, transcripts, notes, glossary data, and application state must be written locally first.

If:

- the network is unavailable,
- Google is unavailable,
- a provider is unavailable,
- the user signs out of Google,

existing local course data must remain usable.

Cloud sync is optional enhancement only.

---

# PRINCIPLE-06 — Provider Independence

LectureRelay must not be architected as a wrapper around one AI vendor.

Provider integrations must be replaceable.

Conceptual provider matrix:

```text
Speech-to-Text
├── Local
├── Groq
├── OpenAI
└── Future Provider

Translation / LLM
├── Local
├── Gemini
├── Groq
├── OpenAI
├── OpenRouter
└── Future Provider
```

External provider policy or pricing changes must not require redesigning the product.

---

# PRINCIPLE-07 — Professional Windows Application Structure

LectureRelay must be engineered and packaged as a normal Windows desktop product.

The repository, runtime filesystem, build output, installer layout, and user-data layout must follow clear ownership boundaries.

No production feature may scatter files across arbitrary directories.

No runtime component may assume the repository directory exists on an end-user machine.

No runtime component may write user data beside the executable.

This principle is mandatory.

---

# 4. Target Users

## 4.1 Primary Users

Students attending English-taught university courses who prefer Chinese, Japanese, or Korean for comprehension support.

Typical users include:

- international undergraduate students,
- international graduate students,
- exchange students,
- technical-course students facing unfamiliar terminology,
- students who understand English but miss details in fast lectures.

---

## 4.2 Secondary Users

Future releases may support:

- students using other assistance languages,
- researchers attending seminars,
- domestic students wanting transcription and review,
- professionals attending technical training.

These are not the primary v1 focus.

---

# 5. Initial Language Scope

## 5.1 Lecture Language

MVP:

- English only.

## 5.2 Assistance Languages

MVP:

- Chinese,
- Japanese,
- Korean.

The internal architecture MUST NOT hard-code English-to-Chinese behavior.

---

# 6. Core User Journey

## 6.1 First Launch

The user should be able to:

1. choose assistance language;
2. choose AI mode;
3. optionally configure provider keys;
4. create a course;
5. begin a lecture.

Suggested AI choices:

### Free & Private
Local STT + local LLM where hardware permits.

### Free Cloud
User-provided free-tier providers where available.

### Premium Providers
User-provided paid provider keys.

---

## 6.2 Create Course

A course may contain:

- course name,
- course code,
- subject category,
- academic level,
- description,
- lecture language,
- assistance language,
- glossary,
- syllabus,
- slides.

---

## 6.3 Start Lecture

LectureRelay should:

1. capture audio,
2. record locally,
3. transcribe English,
4. translate finalized segments,
5. show bilingual captions,
6. timestamp transcript data,
7. persist progress continuously.

---

## 6.4 End Lecture

The user should be able to:

- reopen the lecture,
- replay audio,
- click transcript segments to seek,
- generate notes,
- generate chapters,
- ask lecture-grounded questions,
- generate review materials.

---

# 7. Course Context

Course Context is a core product capability.

The product must know more than the current audio stream.

---

## 7.1 Course Context Inputs

Supported context:

- course title,
- course code,
- subject category,
- academic level,
- course description,
- user glossary,
- syllabus,
- imported slides,
- terminology learned from previous lectures.

---

## 7.2 Initial Subject Categories

MVP categories:

- Computer Science
- Engineering
- Mathematics
- Physics
- Chemistry
- Biology / Medicine
- Business / Economics
- Social Sciences
- Humanities
- Geography / Earth Science
- Law
- Other

A free-text description MUST be supported.

---

## 7.3 Course Context Usage

### Speech Recognition

Context should improve:

- spelling,
- acronyms,
- technical names,
- method names,
- software names,
- domain vocabulary.

### Translation

Context should improve:

- terminology consistency,
- technical-term preservation,
- proper-noun handling,
- bilingual display decisions.

### Notes

Context should improve identification of:

- definitions,
- methods,
- formulas,
- evidence,
- examples,
- instructor emphasis,
- assignments,
- review-relevant material.

### Q&A

Answers should be grounded using:

- transcript,
- course context,
- attached lecture/course documents,
- glossary.

---

## 7.4 Dynamic Glossary

Each course should maintain a persistent glossary.

Users must be able to:

- add terms,
- edit terms,
- remove terms,
- accept suggested terms,
- reject suggested terms.

Automatically learned terms MUST NOT silently overwrite user corrections.

---

# 8. Account and Sync Model

---

## 8.1 No Traditional Account Requirement

LectureRelay v1 shall not require a traditional LectureRelay account system.

No mandatory:

- username/password,
- password reset,
- email verification,
- phone verification,
- proprietary account database.

---

## 8.2 Optional Google Sign-In

Google sign-in is an optional sync feature.

The intended product meaning is:

> **Sign in with Google to enable sync.**

It is not a prerequisite for LectureRelay.

---

## 8.3 Google Drive Sync

Recommended sync target:

- Google Drive `appDataFolder` or another least-privilege application-specific storage mechanism.

The application should request the narrowest possible Google scope.

---

## 8.4 Sync Scope

Default sync SHOULD include:

- course metadata,
- course descriptions,
- subject categories,
- assistance-language settings,
- glossary,
- lecture metadata,
- notes,
- chapters.

Transcript sync:

- supported later in v1,
- default OFF.

Recording sync:

- NOT part of MVP,
- future opt-in feature.

API key sync:

- permanently forbidden.

---

## 8.5 Phone Login

Phone-number authentication is explicitly NOT part of MVP or v1 baseline.

Reasons include:

- SMS cost,
- fraud risk,
- international delivery complexity,
- abuse prevention,
- legal/regional variation,
- unnecessary infrastructure.

It may be reconsidered later.

---

# 9. Functional Requirements

Priority labels:

- **MUST** — required for MVP release.
- **SHOULD** — targeted for v1 but may follow initial MVP.
- **COULD** — future capability.

---

# 9.1 Course Management

**FR-COURSE-001 — MUST**  
The user shall be able to create a course.

**FR-COURSE-002 — MUST**  
A course shall contain:

- name,
- subject category,
- lecture language,
- assistance language.

**FR-COURSE-003 — MUST**  
The user shall be able to edit and delete courses.

**FR-COURSE-004 — MUST**  
Lecture history shall be grouped by course.

**FR-COURSE-005 — MUST**  
The user shall be able to provide a course description.

**FR-COURSE-006 — MUST**  
Each course shall support a glossary.

**FR-COURSE-007 — SHOULD**  
A course shall support academic level.

**FR-COURSE-008 — SHOULD**  
A course shall support syllabus attachment.

**FR-COURSE-009 — SHOULD**  
The application shall suggest candidate glossary terms.

---

# 9.2 Audio Capture

**FR-AUDIO-001 — MUST**  
Capture microphone audio on Windows.

**FR-AUDIO-002 — MUST**  
Record lecture audio locally.

**FR-AUDIO-003 — MUST**  
Recording must survive application restart after successful save/recovery.

**FR-AUDIO-004 — SHOULD**  
Capture Windows system audio for online lectures.

**FR-AUDIO-005 — MUST**  
Allow input-device selection.

**FR-AUDIO-006 — MUST**  
Display input health/activity.

**FR-AUDIO-007 — COULD**  
Support simultaneous microphone and system-audio capture.

**FR-AUDIO-008 — MUST**  
Audio failure must trigger a visible warning.

---

# 9.3 Real-Time Transcription

**FR-STT-001 — MUST**  
Provide near-real-time English transcription.

**FR-STT-002 — MUST**  
Transcript segments shall contain timestamps.

**FR-STT-003 — MUST**  
Partial text and finalized text shall be distinguishable.

**FR-STT-004 — MUST**  
Finalized transcript segments shall be persisted locally.

**FR-STT-005 — SHOULD**  
Use course glossary/context as provider hints when supported.

**FR-STT-006 — MUST**  
Support at least one fully local speech-recognition option.

**FR-STT-007 — SHOULD**  
Support user-configurable cloud STT.

**FR-STT-008 — MUST**  
Network/provider failure must not corrupt existing lecture state.

---

# 9.4 Translation

**FR-TRANS-001 — MUST**  
Translate English transcript segments into:

- Chinese,
- Japanese,
- Korean.

**FR-TRANS-002 — MUST**  
Original English must remain available.

**FR-TRANS-003 — MUST**  
Translation must remain linked to source segment and timestamp.

**FR-TRANS-004 — MUST**  
Course Context shall be available to translation pipelines.

**FR-TRANS-005 — SHOULD**  
Preserve English technical terms where ambiguity exists.

**FR-TRANS-006 — MUST**  
Translation can be disabled independently from transcription.

---

# 9.5 Live Caption UI

**FR-CAP-001 — MUST**  
Display English and translated text in a readable live layout.

**FR-CAP-002 — MUST**  
Current content must remain easy to follow.

**FR-CAP-003 — SHOULD**  
Font size shall be adjustable.

**FR-CAP-004 — SHOULD**  
Either language may be hidden.

**FR-CAP-005 — MUST**  
The layout must work on common laptop resolutions.

---

# 9.6 Timeline and Playback

**FR-TIME-001 — MUST**  
Each lecture shall have a persistent timeline.

**FR-TIME-002 — MUST**  
Transcript segments shall map to timestamps.

**FR-TIME-003 — MUST**  
Clicking a segment shall seek audio playback.

**FR-TIME-004 — SHOULD**  
Generated chapters shall map to time ranges.

**FR-TIME-005 — SHOULD**  
AI answers should cite relevant lecture timestamps.

---

# 9.7 AI Notes

**FR-NOTE-001 — MUST**  
Generate structured notes after a lecture.

**FR-NOTE-002 — MUST**  
Notes shall use transcript content.

**FR-NOTE-003 — MUST**  
Notes shall use Course Context.

**FR-NOTE-004 — MUST**  
Default notes should identify:

- topics,
- key points,
- definitions,
- important terminology,
- methods,
- examples,
- instructor emphasis,
- assignments/action items when present,
- review topics.

**FR-NOTE-005 — SHOULD**  
Notes should preserve timestamp references.

**FR-NOTE-006 — SHOULD**  
Notes may be regenerated with another provider/template.

**FR-NOTE-007 — MUST**  
Users shall be able to edit notes.

---

# 9.8 Chapters

**FR-CHAP-001 — SHOULD**  
Generate meaningful chapters.

**FR-CHAP-002 — SHOULD**  
Each chapter should include:

- title,
- start timestamp,
- optional summary.

**FR-CHAP-003 — SHOULD**  
Selecting a chapter shall seek audio.

---

# 9.9 Ask This Lecture

**FR-QA-001 — MUST**  
The user shall be able to ask natural-language questions about a completed lecture.

**FR-QA-002 — MUST**  
Answers shall be grounded primarily in lecture content.

**FR-QA-003 — MUST**  
Relevant lecture segments shall be retrieved before answer generation.

**FR-QA-004 — SHOULD**  
Answers should cite timestamps.

**FR-QA-005 — MUST**  
If evidence is insufficient, the system shall say so rather than invent support.

**FR-QA-006 — SHOULD**  
Attached slides/syllabus may be included when explicitly available.

---

# 9.10 Review Tools

**FR-REVIEW-001 — SHOULD**  
Generate a study guide.

**FR-REVIEW-002 — SHOULD**  
Generate review questions.

**FR-REVIEW-003 — SHOULD**  
Generate quizzes.

**FR-REVIEW-004 — COULD**  
Generate flashcards.

**FR-REVIEW-005 — COULD**  
Highlight repeatedly emphasized concepts.

---

# 9.11 Documents and Slides

**FR-DOC-001 — SHOULD**  
Import syllabus documents.

**FR-DOC-002 — SHOULD**  
Imported content may become Course Context.

**FR-DOC-003 — COULD**  
Import lecture slides/PDFs.

**FR-DOC-004 — COULD**  
Automatically align slides to lecture timestamps.

Slide alignment is not an MVP blocker.

---

# 9.12 Provider Configuration

**FR-AI-001 — MUST**  
AI providers shall be abstracted behind application interfaces.

**FR-AI-002 — MUST**  
At least one zero-cost local path shall exist.

**FR-AI-003 — MUST**  
Users may provide their own cloud API keys.

**FR-AI-004 — MUST**  
LectureRelay maintainers shall not pay end-user inference bills.

**FR-AI-005 — MUST**  
OpenAI may be supported as an optional paid provider.

**FR-AI-006 — SHOULD**  
STT, translation, notes, and Q&A may use different providers.

**FR-AI-007 — SHOULD**  
Offer an automatic recommended configuration.

**FR-AI-008 — SHOULD**  
Support OpenAI-compatible endpoints in advanced settings.

**FR-AI-009 — MUST**  
Do not describe third-party free tiers as permanently free.

---

# 9.13 Local AI

**FR-LOCAL-001 — MUST**  
Support local STT.

**FR-LOCAL-002 — SHOULD**  
Support local LLM inference.

**FR-LOCAL-003 — MUST**  
Model installation must be integrated into the application experience.

**FR-LOCAL-004 — MUST**  
End users shall not need command-line installation.

**FR-LOCAL-005 — SHOULD**  
Recommend model size based on hardware.

---

# 9.14 Data Management

**FR-DATA-001 — MUST**  
Store course and lecture metadata locally.

**FR-DATA-002 — MUST**  
Preserve recordings and transcript data between restarts.

**FR-DATA-003 — MUST**  
Allow deletion of a lecture and associated local data.

**FR-DATA-004 — SHOULD**  
Export transcript and notes.

**FR-DATA-005 — SHOULD**  
Support Markdown export.

**FR-DATA-006 — COULD**  
Support TXT, JSON, SRT, VTT, and PDF export.

**FR-DATA-007 — SHOULD**  
Support whole-course backup/export.

---

# 10. Windows Application and Filesystem Contract

This section is mandatory.

LectureRelay must follow a professional Windows desktop application layout.

The repository layout and the installed application layout are separate concerns.

---

## 10.1 Installation Directory

The installed application binary and immutable packaged resources belong under a normal Windows application installation directory, for example:

```text
C:\Program Files\LectureRelay\
```

Possible contents:

```text
LectureRelay.exe
resources\
runtime\
licenses\
uninstall data
```

Runtime user data MUST NOT be written into `Program Files`.

---

## 10.2 User Data Root

Per-user runtime data MUST use a stable Windows application-data location.

Recommended:

```text
%LOCALAPPDATA%\LectureRelay\
```

Example:

```text
%LOCALAPPDATA%\LectureRelay\
├── app.db
├── courses\
├── cache\
├── models\
├── logs\
├── temp\
├── recovery\
└── state\
```

The exact structure shall be finalized during technical design but must remain versioned and documented.

---

## 10.3 User-Visible Lecture Files

Large user-owned lecture artifacts should be stored in a clear user-accessible location.

Recommended default:

```text
%USERPROFILE%\Documents\LectureRelay\
```

Example:

```text
Documents\
└── LectureRelay\
    ├── Courses\
    │   ├── GEOG617\
    │   │   ├── 2026-09-29\
    │   │   │   ├── recording.m4a
    │   │   │   ├── transcript.json
    │   │   │   ├── notes.md
    │   │   │   └── metadata.json
    │   │   └── ...
    │   └── ...
    └── Exports\
```

The user SHOULD be able to choose another library root.

---

## 10.4 Credentials

Credentials MUST NOT be stored under:

```text
Documents\
AppData\LectureRelay\*.json
SQLite
repository files
```

Credentials belong only in Windows secure credential storage.

---

## 10.5 Cache

Disposable data belongs under:

```text
%LOCALAPPDATA%\LectureRelay\cache\
```

Cache MUST be safe to delete.

Examples:

- temporary waveform data,
- temporary thumbnails,
- downloaded provider metadata,
- reusable non-sensitive computed artifacts.

The application SHOULD provide:

> Clear Cache

---

## 10.6 Model Storage

Locally downloaded AI models SHOULD be stored under:

```text
%LOCALAPPDATA%\LectureRelay\models\
```

or an explicitly user-selected model directory.

Model storage must:

- be separate from source code;
- be separate from user recordings;
- support versioned models;
- support model removal;
- support disk-usage display;
- never require write access to `Program Files`.

---

## 10.7 Logs

Logs SHOULD live under:

```text
%LOCALAPPDATA%\LectureRelay\logs\
```

Production logs MUST:

- rotate,
- have bounded size,
- exclude API keys,
- exclude full lecture text by default,
- exclude raw audio,
- exclude sensitive provider payloads unless explicit debug mode is enabled.

Debug logging that may contain sensitive content MUST require explicit user opt-in and clear warning.

---

## 10.8 Recovery Data

In-progress lecture recovery state SHOULD live under:

```text
%LOCALAPPDATA%\LectureRelay\recovery\
```

Recovery data must be:

- incrementally written,
- bounded,
- removed after successful lecture finalization,
- safe to inspect during crash recovery.

---

## 10.9 Temporary Data

Temporary files belong under:

```text
%LOCALAPPDATA%\LectureRelay\temp\
```

or the Windows temporary directory where appropriate.

Temporary data must be cleaned after successful completion.

The application must not create permanent orphan files in random directories.

---

## 10.10 Database

The primary local metadata database SHOULD use SQLite or an equivalent embedded database.

Recommended location:

```text
%LOCALAPPDATA%\LectureRelay\app.db
```

The database shall store:

- course metadata,
- lecture metadata,
- references to artifact files,
- transcript metadata where appropriate,
- notes metadata,
- sync state,
- non-secret application state.

The database MUST NOT store plaintext API keys.

---

## 10.11 Filesystem Ownership Rules

Every runtime artifact must belong to one of:

1. Install files
2. User library files
3. Application state
4. Cache
5. Models
6. Logs
7. Temporary files
8. Recovery files
9. Secure credentials

A new file type may not be introduced without assigning it to a documented category.

---

## 10.12 No Repository-Relative Runtime Writes

Production code MUST NOT write runtime files to paths such as:

```text
./data
./output
./logs
./models
./tmp
```

relative to the executable or development repository.

Repository-relative paths are allowed only in development tooling and tests.

---

# 11. Repository Organization Requirements

The code repository must remain understandable to an experienced full-stack engineer without tribal knowledge.

The project must use clear ownership boundaries.

A recommended structure is:

```text
lecturerelay/
├── apps/
│   └── desktop/
│       ├── src/
│       ├── src-tauri/
│       ├── public/
│       └── tests/
│
├── packages/
│   ├── domain/
│   ├── providers/
│   ├── shared-types/
│   └── ui/
│
├── crates/
│   ├── audio/
│   ├── storage/
│   ├── security/
│   └── platform-windows/
│
├── docs/
│   ├── requirements/
│   ├── architecture/
│   ├── decisions/
│   ├── security/
│   └── testing/
│
├── scripts/
│   ├── dev/
│   ├── build/
│   └── release/
│
├── tests/
│   ├── integration/
│   └── fixtures/
│
├── .github/
│   └── workflows/
│
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── package/workspace manifests
```

This structure may change during architecture design, but the following rules are mandatory.

---

## 11.1 Repository Hygiene

The repository root MUST NOT become a dumping ground.

Root-level files should be limited to:

- workspace manifests,
- standard project documentation,
- standard configuration,
- top-level license/security/contribution files.

Do not place arbitrary:

- recordings,
- generated JSON,
- test output,
- copied models,
- screenshots,
- personal notes,
- temporary scripts,
- API keys,
- local databases,

in the repository root.

---

## 11.2 Build Artifacts

Generated build output must be ignored by Git.

Examples:

```text
target\
dist\
build\
node_modules\
coverage\
artifacts\
```

Build outputs shall be reproducible from source.

---

## 11.3 Test Fixtures

Test samples must live in dedicated fixture directories.

No production user data may ever be committed as test fixtures.

---

## 11.4 Scripts

Scripts must have clear purpose and ownership.

Forbidden pattern:

```text
fix.py
fix2.py
test_new.py
temp.ps1
try_this.ps1
final_final.ps1
```

Required pattern:

```text
scripts/
├── dev/
│   └── setup-dev.ps1
├── build/
│   └── build-windows.ps1
└── release/
    └── package-release.ps1
```

---

## 11.5 Architecture Boundaries

Frontend components must not directly implement:

- Windows credential storage,
- raw filesystem layout,
- audio-device internals,
- provider HTTP authentication,
- database migrations.

These concerns belong behind explicit backend/service interfaces.

---

## 11.6 Provider Isolation

Each AI provider integration must be isolated.

Provider-specific code must not leak through the entire application.

Conceptual interface:

```text
TranscriptionProvider
TranslationProvider
NotesProvider
QuestionAnsweringProvider
EmbeddingProvider
```

Provider replacement must not require rewriting course or UI logic.

---

## 11.7 Domain Model Separation

Core domain concepts should remain independent from UI frameworks.

Examples:

```text
Course
Lecture
TranscriptSegment
TranslationSegment
Chapter
CourseContext
GlossaryTerm
NoteDocument
ProviderConfig
SyncState
```

The product must not encode core business rules only inside React components.

---

# 12. Technology Direction

The final architecture will be specified separately.

The current preferred implementation direction is:

```text
Desktop Shell
Tauri 2

Frontend
React + TypeScript

Native / Systems Layer
Rust

Local Database
SQLite

Platform
Windows first
```

This direction is not a license to begin implementation before architecture review.

---

# 13. Non-Functional Requirements

---

## 13.1 Usability

**NFR-UX-001 — MUST**  
A non-technical student can install and start LectureRelay without a terminal.

**NFR-UX-002 — MUST**  
Normal onboarding must not require understanding CUDA, Python, package managers, or model paths.

**NFR-UX-003 — MUST**  
Starting a lecture must require only a small number of obvious steps.

**NFR-UX-004 — MUST**  
Advanced provider settings must be separated from normal usage.

---

## 13.2 Performance

**NFR-PERF-001 — MUST**  
Live captions must feel responsive enough for active lecture use.

**NFR-PERF-002 — SHOULD**  
Finalized transcription should normally appear within a few seconds on supported configurations.

**NFR-PERF-003 — SHOULD**  
Translation should follow finalized speech without materially disrupting comprehension.

**NFR-PERF-004 — MUST**  
Background AI work must not compete aggressively with live lecture processing.

---

## 13.3 Reliability

**NFR-REL-001 — MUST**  
Provider failure shall not erase already captured lecture data.

**NFR-REL-002 — MUST**  
Unexpected application termination should minimize lecture loss.

**NFR-REL-003 — MUST**  
Lecture state should be persisted incrementally.

**NFR-REL-004 — SHOULD**  
Interrupted lectures should be recoverable.

---

## 13.4 Privacy

**NFR-PRIV-001 — MUST**  
Local Mode shall not send lecture content to cloud AI services.

**NFR-PRIV-002 — MUST**  
Cloud processing must be clearly identified.

**NFR-PRIV-003 — MUST**  
Users should be able to understand what data leaves the machine.

**NFR-PRIV-004 — MUST**  
Telemetry is OFF by default unless explicitly enabled.

---

## 13.5 Accessibility

**NFR-ACC-001 — SHOULD**  
Adjustable caption font size.

**NFR-ACC-002 — SHOULD**  
Keyboard navigation for major controls.

**NFR-ACC-003 — SHOULD**  
Readable contrast during long sessions.

---

## 13.6 Maintainability

**NFR-MAINT-001 — MUST**  
Provider-specific code must be isolated.

**NFR-MAINT-002 — MUST**  
External provider changes must not require redesigning core domain logic.

**NFR-MAINT-003 — MUST**  
Filesystem paths must be centralized behind a platform-path service.

**NFR-MAINT-004 — MUST**  
Database schema migrations must be versioned.

**NFR-MAINT-005 — MUST**  
Core data formats and storage rules must be documented.

**NFR-MAINT-006 — SHOULD**  
Automated tests shall cover persistence, provider abstraction, and recovery.

---

# 14. Windows Packaging Requirements

**WIN-PKG-001 — MUST**  
Distribute LectureRelay as a normal Windows installer.

**WIN-PKG-002 — MUST**  
Users shall not manually install dependencies.

**WIN-PKG-003 — MUST**  
Runtime dependencies shall be bundled or installed automatically.

**WIN-PKG-004 — MUST**  
Uninstall must remove application binaries cleanly.

**WIN-PKG-005 — MUST**  
Uninstall must not silently delete user lecture data without explicit confirmation.

**WIN-PKG-006 — SHOULD**  
Installer should support per-user installation where practical.

**WIN-PKG-007 — SHOULD**  
Code signing should be added before broad public distribution.

**WIN-PKG-008 — SHOULD**  
Automatic update support may be added after initial release infrastructure is stable.

---

# 15. Sync Requirements

**SYNC-001 — SHOULD**  
Google sign-in enables optional sync.

**SYNC-002 — MUST**  
Core local functionality works while signed out.

**SYNC-003 — MUST**  
API keys are never synced.

**SYNC-004 — SHOULD**  
Course metadata, notes, chapters, and glossaries may sync.

**SYNC-005 — SHOULD**  
Transcript sync may be opt-in.

**SYNC-006 — COULD**  
Recording sync may be added later.

**SYNC-007 — MUST**  
Sync failures must not corrupt local data.

**SYNC-008 — MUST**  
Local data is source-of-truth until a formal conflict-resolution design is implemented.

---

# 16. MVP Scope

---

## 16.1 MUST Include

### Platform

- Windows-first
- native desktop application
- normal installer
- no terminal requirement
- no Python requirement for end users
- no manual CUDA setup

### Language

- English lecture input
- Chinese assistance
- Japanese assistance
- Korean assistance

### Course

- create/edit/delete course
- subject category
- description
- assistance language
- Course Context
- glossary

### Live Lecture

- microphone capture
- recording
- near-real-time English transcription
- near-real-time translation
- bilingual captions
- recording state
- elapsed time
- pause/stop
- audio health indicator

### Timeline

- transcript timestamps
- local audio playback
- click transcript → seek audio
- lecture history

### AI

- structured notes
- Ask This Lecture
- lecture-grounded retrieval
- provider abstraction
- BYOK
- optional OpenAI support
- local STT path

### Security

- Windows secure credential storage
- no key in prompt/model/log/telemetry/sync
- no LectureRelay API proxy

### Performance

- Quiet Mode default
- no heavy background jobs during class
- resource-aware local model selection
- pausable background AI jobs

### UX

- sage green + muted gold
- Apple-inspired rounded visual language
- low-distraction live mode
- consumer-grade polish

### Privacy

- local-first
- no account required
- clear cloud-processing disclosure

### Filesystem

- documented Windows paths
- no runtime writes beside `.exe`
- no random folders
- separate user library / app state / cache / logs / models / recovery / temp
- secure credentials outside normal files

---

## 16.2 SHOULD Include in v1

- Windows system-audio capture
- automatic chapters
- study guide
- quiz generation
- syllabus import
- dynamic glossary suggestions
- Markdown export
- hardware detection
- model recommendation
- Google login
- Google Drive sync
- notes sync
- glossary sync
- opt-in transcript sync

---

## 16.3 COULD Include Later

- slide-to-timestamp alignment
- flashcards
- recording cloud sync
- phone login
- email login
- Microsoft login
- Apple login
- macOS
- Linux
- mobile companion
- LMS integration
- calendar integration
- additional languages
- speaker diarization
- student collaboration
- teacher mode

---

# 17. Explicit Non-Goals

LectureRelay v1 will not:

- require subscription billing,
- sell API usage,
- provide a shared OpenAI key,
- run a LectureRelay inference proxy,
- require account creation,
- support phone verification,
- sync API keys,
- upload recordings automatically,
- support dozens of languages,
- build a mobile app,
- prioritize macOS over Windows,
- become an LMS,
- become a meeting-management product.

---

# 18. AI Quality Requirements

## 18.1 Transcription

Prioritize:

- correct terminology,
- course-aware spelling,
- stable timestamps,
- useful segmentation.

---

## 18.2 Translation

Translation must optimize for comprehension.

It should:

- preserve formulas,
- preserve proper nouns,
- preserve useful English technical terms,
- avoid unnatural literal translation,
- remain concise enough for live reading.

---

## 18.3 Notes

Notes must not fabricate:

- assignments,
- deadlines,
- claims,
- instructor opinions.

When inference is used, generated structure must remain distinguishable from lecture evidence.

---

## 18.4 Q&A

The system should prefer:

> The lecture does not provide enough information to answer this.

over unsupported invention.

---

# 19. Conceptual Domain Model

```text
Course
├── id
├── name
├── code
├── subject_category
├── academic_level
├── description
├── lecture_language
├── assistance_language
├── glossary[]
└── context_assets[]

Lecture
├── id
├── course_id
├── title
├── start_time
├── end_time
├── recording_ref
├── transcript_segments[]
├── chapters[]
├── notes
├── study_material
└── provider_metadata

TranscriptSegment
├── id
├── lecture_id
├── start_time
├── end_time
├── source_text
├── translated_text
├── status
└── metadata
```

The exact database schema is deferred to technical design.

---

# 20. Privacy Modes

LectureRelay should support three conceptual modes.

---

## 20.1 Local Mode

```text
Local STT
+
Local LLM
+
Local Storage
```

No lecture content is sent to third-party AI providers.

---

## 20.2 User Cloud Mode

```text
Local Application
+
User's Own API Key
+
Official Provider API
```

LectureRelay does not proxy the request.

---

## 20.3 Mixed Mode

Example:

```text
Local STT
+
Cloud Translation
+
Cloud Notes
+
Local Storage
```

The UI must show which components are local and which use cloud processing.

---

# 21. Installation and Onboarding

Expected user experience:

```text
Download LectureRelay
        ↓
Run Installer
        ↓
Open
        ↓
Choose Assistance Language
        ↓
Choose AI Mode
        ↓
Create Course
        ↓
Start Lecture
```

Forbidden end-user onboarding:

```text
git clone
pip install
uv sync
npm install
edit JSON
set environment variables manually
configure CUDA manually
run .bat files from source tree
```

---

# 22. MVP Acceptance Test

The MVP is functionally acceptable when a fresh Windows user can:

1. download a Windows installer;
2. install LectureRelay;
3. launch without Python or terminal use;
4. choose Chinese, Japanese, or Korean;
5. create `Introduction to Biology`;
6. select `Biology / Medicine`;
7. add `Genetics, molecular biology, and cell biology`;
8. start a microphone lecture;
9. see English transcription;
10. see translated text;
11. stop the lecture;
12. reopen the lecture;
13. play the recording;
14. click transcript text and seek to that audio;
15. generate notes;
16. ask a lecture-grounded question;
17. receive an answer based on relevant transcript content;
18. close LectureRelay;
19. reopen LectureRelay;
20. confirm the course, recording, transcript, and notes still exist;
21. complete this workflow with at least one no-paid-API configuration;
22. complete the lecture without sustained excessive fan noise or resource usage on supported hardware.

---

# 23. Engineering Acceptance Test

The implementation is not release-ready unless:

- runtime files obey the Windows filesystem contract;
- no user data is written beside the `.exe`;
- no secrets appear in application files;
- app-data paths are centralized;
- database migrations are versioned;
- repository root remains clean;
- build artifacts are ignored;
- generated models are not committed;
- test fixtures are isolated;
- provider integrations are modular;
- domain logic is not buried in frontend components;
- uninstall behavior is tested;
- crash recovery is tested;
- long-lecture persistence is tested;
- logs are audited for secrets.

---

# 24. Success Metrics

Initial product quality should prioritize real use, not only GitHub stars.

## Product

- crash-free lecture sessions,
- successful 90–180 minute lecture runs,
- median caption latency,
- successful lecture recovery,
- note generation success,
- grounded Q&A success,
- fan/noise/resource benchmarks.

## User

- repeat weekly users,
- courses per user,
- lectures per week,
- multi-course usage,
- retention after first week.

## Open Source

- release downloads,
- GitHub stars,
- forks,
- contributors,
- resolved issues,
- provider/community contributions.

Telemetry remains opt-in.

---

# 25. Risks

## R-01 — Third-Party Free Tiers Change

Mitigation:

- local mode,
- provider abstraction,
- no permanent-free cloud claims.

## R-02 — Local AI Uses Too Many Resources

Mitigation:

- Quiet Mode,
- model-size detection,
- deferred post-processing,
- cloud alternatives.

## R-03 — Technical Terms Are Misrecognized

Mitigation:

- Course Context,
- glossary,
- syllabus,
- slide context,
- provider hotwords.

## R-04 — Lecture Data Is Lost

Mitigation:

- incremental persistence,
- recovery directory,
- finalization checks,
- crash tests.

## R-05 — Privacy Confusion

Mitigation:

- local-first defaults,
- provider disclosure,
- no mandatory account,
- clear sync controls.

## R-06 — Repository/Filesystem Becomes Disorganized

Mitigation:

- documented repository boundaries,
- documented Windows storage contract,
- code review rules,
- central path service,
- no ad-hoc file creation.

## R-07 — Product Drifts Into Meeting Software

Mitigation:

Every major feature must answer:

> Does this improve a student's ability to understand, retain, or review a course?

---

# 26. Decisions Frozen in v1.0

The following decisions are now part of the requirements baseline:

1. Product name is **LectureRelay**.
2. Primary platform is **Windows**.
3. Product will be **open-source**.
4. Lecture language for MVP is **English**.
5. Assistance languages are **Chinese, Japanese, and Korean**.
6. Product is **student-first**, not meeting-first.
7. **Quiet Mode** is the default live runtime profile.
8. API keys are treated as secret credentials.
9. API keys never enter prompts, model context, logs, telemetry, sync, or LectureRelay servers.
10. LectureRelay does not run a shared API proxy.
11. Users may bring their own paid provider keys.
12. A no-paid-API path must exist.
13. Core functionality requires no login.
14. Google login is optional and exists for sync.
15. Google Sync is a **v1 SHOULD**, not an MVP blocker.
16. Transcript sync is opt-in and default OFF.
17. Recording sync is deferred.
18. Phone login is deferred.
19. Local-first storage is mandatory.
20. Course Context is a core capability.
21. Timeline and timestamps are first-class data.
22. The UI uses sage green, muted gold, rounded geometry, generous whitespace, and Apple-inspired simplicity.
23. Live lecture UI must remain low-distraction.
24. The application must ship as a normal Windows installer.
25. End users shall not use Python, package managers, or source-tree scripts.
26. Application install files, user data, cache, logs, models, recovery files, and credentials must have documented separate locations.
27. Runtime user data shall never be written beside the `.exe`.
28. The source repository must follow professional, modular project organization.
29. Provider-specific logic must remain isolated.
30. Business/domain logic must not live only inside frontend UI components.

---

# 27. Development Process

Implementation shall follow this sequence.

## Stage 1 — Requirements

- Requirements baseline — **this document**
- change-control process

## Stage 2 — UX / Information Architecture

Produce:

- information architecture,
- onboarding flow,
- course creation flow,
- live lecture flow,
- post-lecture flow,
- provider/settings flow,
- Google sync flow,
- wireframes,
- empty/error/loading states,
- visual design tokens.

## Stage 3 — System Architecture

Produce:

- component diagram,
- process boundaries,
- Windows process model,
- frontend/backend boundary,
- local/cloud trust boundaries,
- provider interfaces,
- filesystem-path service,
- persistence architecture,
- audio architecture,
- sync architecture,
- security architecture.

## Stage 4 — Technical Design

Produce specifications for:

- repository layout,
- Windows installer,
- audio capture,
- system-audio capture,
- recording format,
- STT streaming,
- translation pipeline,
- Course Context,
- provider abstraction,
- SQLite schema,
- database migration strategy,
- lecture retrieval/RAG,
- secure key storage,
- filesystem layout,
- crash recovery,
- logging,
- model manager,
- performance budgets.

## Stage 5 — Project Planning

Produce:

- epics,
- milestones,
- GitHub issues,
- dependency graph,
- acceptance tests,
- release gates.

## Stage 6 — Implementation

Implementation begins only after architecture and technical-design approval.

## Stage 7 — Verification

Perform:

- unit tests,
- integration tests,
- long-lecture tests,
- low-resource laptop tests,
- fan/noise/thermal tests,
- provider-failure tests,
- offline tests,
- recovery tests,
- multilingual tests,
- installer tests,
- uninstall tests,
- credential-leak tests,
- sync-conflict tests.

## Stage 8 — Release

Prepare:

- Windows installer,
- release notes,
- GitHub release,
- README,
- user guide,
- privacy statement,
- provider guide,
- contributor guide,
- security policy,
- known limitations.

---

# 28. Change Control

This document is the formal product requirements baseline.

A new feature must not be added directly to implementation.

Every proposed change must:

1. identify the user problem;
2. identify affected requirement IDs;
3. classify the change as MUST / SHOULD / COULD;
4. determine whether MVP scope changes;
5. record the decision;
6. update the requirements;
7. update architecture if necessary;
8. only then enter implementation.

Coding-agent convenience is never sufficient justification for architecture or product changes.

---

# 29. Final Product Test

Every feature should be evaluated using this question:

> **Does this help a student understand an English lecture now, preserve it accurately, or review it later without creating unnecessary complexity, privacy risk, or computer load?**

If the answer is no, the feature is outside LectureRelay's core product.

---

# Appendix A — Runtime Filesystem Summary

```text
C:\Program Files\LectureRelay\
└── immutable application files

%LOCALAPPDATA%\LectureRelay\
├── app.db
├── cache\
├── models\
├── logs\
├── temp\
├── recovery\
└── state\

%USERPROFILE%\Documents\LectureRelay\
├── Courses\
│   └── <Course>\
│       └── <Lecture>\
│           ├── recording.m4a
│           ├── transcript.json
│           ├── notes.md
│           └── metadata.json
└── Exports\

Windows Credential Manager / DPAPI
└── API Keys
```

No runtime content may be stored arbitrarily elsewhere without an explicit technical-design decision.

---

# Appendix B — Repository Summary

```text
lecturerelay/
├── apps/
│   └── desktop/
├── packages/
├── crates/
├── docs/
├── scripts/
├── tests/
├── .github/
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

The exact module split will be finalized during architecture design.

---

# Appendix C — MVP Product Summary

```text
LectureRelay
│
├── Windows Desktop App
│
├── Courses
│   ├── Subject
│   ├── Description
│   ├── Glossary
│   └── Course Context
│
├── Live Lecture
│   ├── Microphone
│   ├── Recording
│   ├── English STT
│   ├── Chinese / Japanese / Korean
│   └── Bilingual Captions
│
├── Timeline
│   ├── Audio
│   └── Timestamped Transcript
│
├── AI Study
│   ├── Notes
│   ├── Ask This Lecture
│   ├── Chapters
│   └── Quiz / Study Guide
│
├── AI Providers
│   ├── Local
│   ├── Free cloud tiers where available
│   └── BYOK paid providers
│
├── Optional Google Sync
│
└── Local-First Storage
```

