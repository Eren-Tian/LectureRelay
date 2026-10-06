# Windows CI and packaging

`Checks / Windows checks` runs on pull requests targeting `main` and pushes to `main`: frozen pnpm installation, frontend typecheck/build, real React component regressions, ordinary Rust tests, Clippy with warnings denied, both formatters and repository import/link/structure checks. Failures fail the job. Hardware/model tests remain explicitly opt-in, as identified by the Rust test runner's ignored-test output; they are not passed by CI.

Run the browser regressions locally with **`pnpm test:components`** on Windows with Microsoft Edge installed. The command obtains an exact matching official EdgeDriver, starts a private Vite/driver pair on free localhost ports, runs real Settings/model-control, note/action, caption-reader and contrast fixtures, then closes its processes. It needs neither Tauri nor model weights or credentials. The component tests are distinct from installed WebView2 acceptance. Output stays under `target/model-controls`, `target/engineering-audit` and `target/product-iteration`.

## Cold installer

`Windows packaging / Windows installer (cold)` is separately runnable. Before this workflow exists on the default branch, push a scoped `codex/windows-ci-*` branch; a `push` event reads that branch's workflow. After merge, manual dispatch accepts a full 40-character `source_sha`. No merge is needed to test the workflow itself. Do not run untrusted code through `pull_request_target`.

The job checks out that explicit revision on a fresh `windows-2025` hosted runner, refuses pre-existing project dependency/build/runtime folders, uses an empty Cargo dependency home and restores no Actions caches. Node comes from `.node-version`, pnpm from `packageManager`, Rust from `rust-toolchain.toml`; pnpm uses `--frozen-lockfile` and the existing release path forwards `--locked` to Cargo. Public pinned SDK/runtime archives are downloaded and hash-verified through the existing build scripts. Model weights are neither required nor downloaded.

The existing release script builds the C++ speech worker, React frontend, Rust/Tauri app and NSIS installer. The installer verification script installs to the runner's stable per-user Programs directory and checks the actual packaged runtime, icons, license/NOTICE files and release payload. It does not need local developer paths, experiment caches or an earlier installer. A job failure is not converted to a successful artifact.

The artifact `windows-x64-<source-sha>-cold` contains only the installer, its SHA-256 file and `build-metadata.json`. Metadata records source, runner image/version, toolchains, input/manifest hashes, installer size/hash, verification and explicit test exclusions. Retention is 14 days. Tokens have `contents: read`, checkout does not retain credentials, jobs have bounded timeouts and superseded runs on the same PR/ref are cancelled. No release publishing, repository setting changes or paid larger runners are configured.

Metadata also includes SHA-256 values for the installed app and native runtime/license files. To validate a downloaded candidate, close the app and run `scripts/verification/installer.ps1 -InstallerPath "<downloaded EXE>" -BuildMetadata "<downloaded build-metadata.json>"`. This first checks the installer hash/size, then installs to the stable current-user directory and compares its file set and hashes with that hosted build's payload. It does not compare a hosted binary against a different local compiler's output. Without `-BuildMetadata`, it checks the local Release EXE and that build's allowed runtime payload files; subsequent debug builds may change shared staging files and are not the expected installer payload.

A single cold build establishes clean buildability, **not byte-for-byte reproducibility**. Compiler/runner/NSIS differences must not be normalized away to claim binary identity.

## Test tiers and rollout

- Ordinary CI: source/build/style checks and deterministic Rust/React regressions.
- Packaging: cold hosted compile, NSIS installation and packaged-resource checks, without inference models.
- Explicit local acceptance: real audio devices, downloaded local models, installed UI, failures, restart and a timed continuity run. Never substitute native unit tests for installed acceptance.

After review, `Windows checks` can become a required check. `Windows installer (cold)` is an opt-in packaging check unless the team chooses a broader trigger. This task does not change branch protection or merge its own PR. Actual run links and candidate hashes are recorded in the continuity investigation report after execution.

Official references reviewed for this workflow: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [upload-artifact](https://github.com/actions/upload-artifact), [workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). External actions are fixed to release commit SHAs, not floating version tags.
