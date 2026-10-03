# Security — v0.2.0 preview

Provider keys remain non-roaming Generic Credentials at `LectureRelay/provider/{openai,groq}`. Rust reads them when needed and zeroizes owned temporary buffers. Password fields clear before saving; later status is masked. Keys briefly exist in memory/HTTPS headers, but never in SQLite, exports, prompts or diagnostics.

Fixed HTTPS hosts disable redirects/custom URLs. Cloud speech selection sends audio during recording; opt-in translation sends final English and bounded context/glossary. Both are disclosed. Local inference sends no audio to servers. Model installation contacts official Hugging Face download infrastructure. Default None processing makes no cloud AI call. OpenAI text requests set `store: false`; retention/billing follow the provider account.

The hidden C++ worker uses bounded messages, restricted DLL search paths, timeouts and a kill-on-close Windows Job Object. Downloaded weights are revision/size/SHA-256 verified; installed-state checks subsequently validate metadata/length without a full rehash. The SDK archive is pinned/hash-checked during builds, with bundled third-party notices. No runtime auto-update occurs.

No analytics or private-content logging is shipped. One performance JSON per lecture records CPU/RAM/timings/queue/drop counters, excluding content/keys. Provider raw errors are sanitized. Markdown raw HTML is disabled and links remain text. Frontend filesystem/shell/HTTP plugins are disabled; native IPC validates IDs/paths and scopes audio assets.

Database/audio/course files have **no application-level encryption**. Windows Documents may already be OS-synchronized; LectureRelay adds no sync. Backup database/library after exiting and exclude credentials. Trash/uninstall retain user data; no permanent purge is implemented.

Debug UI tests use isolated `target` roots; release ignores the override. Credential tests use unique synthetic targets and clean them up. Benchmarks use synthetic/public audio. Do not publish private content/keys/personal paths. Signing, a source license and a private vulnerability contact remain public-release tasks. No independent security audit has occurred.
