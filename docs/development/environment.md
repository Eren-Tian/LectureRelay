# 开发环境

环境已配置，可运行0.2.0 桌面预览版。产品范围与已知限制见 [README](../../README.md) 和 [版本报告](../releases/v0.2.0.md)。

| 组件                              | 已验证配置                                   |
| --------------------------------- | -------------------------------------------- |
| Node.js / pnpm                    | 24.15.0 / 11.25.0                            |
| Rust / rustup                     | 1.98.1 MSVC x64 / 1.29.1                     |
| Tauri / React / TypeScript / Vite | 2.12.0 / 19.3.0 / 7.0.2 / 8.3.1              |
| SQLite                            | rusqlite 0.40.2 bundled                      |
| 音频                              | CPAL 0.18.2 WASAPI，Hound WAV                |
| 网络 / 凭据                       | reqwest + Rustls，Windows Credential Manager |
| Windows 原生编译                  | 现有 MSVC Build Tools / Windows SDK          |
| 桌面渲染                          | 现有 WebView2 Runtime                        |

依赖精确版本由 manifests、pnpm lockfile、Cargo.lock 和 rust-toolchain.toml 固定。升级时重新检查与打包。

## 工具与输出

`.tools/rustup` 保存 Rust 工具链，`.tools/cargo` 保存 Cargo 入口/缓存，`.tools/downloads` 保存已验证的安装器。`.pnpm-store`、`node_modules`、`target` 和 `apps/desktop/dist` 均被 Git 忽略。它们是开发与构建目录；实际用户数据在 Windows Known Folders，见 [架构说明](../architecture/overview.md)。

无需手动修改系统 PATH。脚本把项目 Rust 路径和正确的 MSVC 环境传入原生构建。编译并发限制为 4，运行时没有据此宣称性能指标。安装后的应用无需 Python、CUDA、FFmpeg 或外部 SQLite；本地识别需在 Settings 下载模型，纯录音无需模型。Python 仅用于开发实验。

```powershell
pnpm run setup
pnpm run doctor
pnpm dev
pnpm build:debug
pnpm build
```

必须使用 `pnpm run setup` / `pnpm run doctor`，避免调用 pnpm 同名内置命令。直接使用 Cargo 前运行 `. .\scripts\dev\activate.ps1`。完整检查命令见 README。

## 端口与打包

Vite 只监听 `127.0.0.1:5173` 并严格检查端口。Tauri devUrl 和开发 CSP 使用同一端口。本机 Windows TCP 排除范围包含 `1333–1432`，因此未采用常见的 1420。出现 EACCES 可检查 `netsh interface ipv4 show excludedportrange protocol=tcp`，无需修改系统端口保留。

`pnpm build` 生成 x64 release EXE 与 NSIS 当前用户安装包，输出位于 `target/x86_64-pc-windows-msvc/release`。NSIS 使用 English，并在需要时下载 Microsoft WebView2 bootstrapper。当前没有代码签名或自动更新。

## 参考

- [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri + Vite](https://v2.tauri.app/start/frontend/vite/)
- [Tauri Windows installer](https://v2.tauri.app/distribute/windows-installer/)
- [Rustup custom paths](https://rust-lang.github.io/rustup/installation/index.html)

## 原生 ASR 构建

`pnpm dev` / `pnpm build` 自动准备 NeMo-Speech.cpp 0.1.0 CPU SDK 并以 MSVC 编译 C++ worker。首次需联网下载约 4.7 MB、核对固定 SHA-256；生产 SDK 缓存在 `target/native/speech-worker`；实验权重与历史缓存保留在 `target/asr-evaluation`。权重不进入安装器。也可单独运行 `pnpm build:asr`。安装器包含 native DLL、worker、许可证和 NOTICE，无 Python / CUDA 运行时。
