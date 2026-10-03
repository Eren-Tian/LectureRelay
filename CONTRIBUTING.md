# Contributing

## Setup and checks

On Windows x64 run `pnpm run setup`, `pnpm run doctor`, then `pnpm dev`. See [environment setup](docs/development/environment.md). Lockfiles and the Rust toolchain are pinned; avoid dependency upgrades unrelated to your change.

Before submitting native/frontend changes run:

```powershell
pnpm check:web
pnpm build:web
pnpm test:rust
pnpm lint:rust
pnpm format:check
pnpm format:rust:check
pnpm verify:repo
pnpm verify:resources
```

Use `pnpm format` and `pnpm format:rust` to format. Packaging/path changes also require `pnpm release` and installer-resource verification. Opt-in hardware, credential, actual-model and long-soak instructions are in [validation](docs/testing/validation.md). Normal tests must not require a microphone, provider key or model download.

## Organization

Consult the [repository map](docs/architecture/repository-structure.md). Keep feature UI with its feature; shared components must be useful across features. The app shell coordinates routes and workspace state. Keep serialized TypeScript contracts in `src/types/domain.ts` and matching Rust domain values in `src-tauri/src/domain.rs`; preserve camelCase IPC and compatible defaults. Formatting/localized labels belong in presentation helpers, not domain contracts. Avoid global barrels and feature cycles.

Rust commands validate input and enforce the existing recording/live/model/job gates. SQL belongs in database repositories; filesystem snapshots/recovery in storage. Speech contracts, cloud HTTP, native worker management and credentials have distinct homes. Do not duplicate compatible OpenAI/Groq HTTP clients. Keep recording timing, queue bounds and cancellation behavior intact when moving code.

Production worker source belongs under `apps/desktop/native/speech-worker`; experiments stay in `experiments/local-stt`. Generated files go under `target` or documented ignored staging. Do not create speculative empty packages or directories.

## Data and migrations

SQLite is authoritative; lecture sidecars are snapshots. Migrations are explicit, versioned SQL under `src-tauri/src/database/migrations`. Never edit a released migration to upgrade existing users: add a new migration, update the version gate and test the previous schema with preserved course, lecture, settings, transcript, notes and answer data. Use transactions and reject databases newer than the application understands.

Tests allocate synthetic UUID roots under `target`. Never point an automated test at production LocalAppData, Documents or real credentials. Credential tests use unique `LectureRelay/tests/<UUID>` targets and remove only their own targets.

## Secrets and assets

Keys enter through native credential commands and leave only in sensitive HTTPS authorization headers to fixed official endpoints. Never log provider response bodies, keys, prompts or lecture content. Review [security](docs/security/overview.md). Do not commit private recordings, model weights, databases, build output, crash dumps or `.env` secrets. The repository scanner reports locations without printing values; review findings and rotate any exposed real credential.

The canonical phoenix is [the SVG source](assets/branding/phoenix/phoenix.svg). Update documented platform copies deliberately. Preserve third-party licenses/NOTICE with staged and installed runtime files; review the audited DLL manifest before changing it.

## Pull requests

Describe the concrete problem, resulting behavior, affected boundaries and validation. Include relevant screenshots for UI changes and migration/resource evidence for native changes. Explain skipped hardware/provider checks. Keep versions unchanged for organization-only work. Do not introduce feature changes under a cleanup title. Public distribution requires a project source license, signing and a private security-reporting channel; do not invent a license without the owner's decision.
