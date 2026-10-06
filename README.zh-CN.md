# LectureRelay

[English](README.md) · **简体中文**

LectureRelay 是一款 **Windows 课堂录音与学习辅助应用**。它将录音、英文字幕、翻译、时间戳回放与课堂笔记放在一起，帮助你跟上课堂，也方便课后复习。**下载 EXE，安装后即可使用，无需注册 LectureRelay 账户，也无需自行构建。**

## 下载与安装

**[下载最新预览版：LectureRelay 0.3.11 · Windows x64 安装包](https://github.com/Eren-Tian/LectureRelay/releases/download/v0.3.11/LectureRelay_0.3.11_x64-setup.exe)**

[更新说明与下载列表](https://github.com/Eren-Tian/LectureRelay/releases/tag/v0.3.11) · [SHA-256 校验文件](https://github.com/Eren-Tian/LectureRelay/releases/download/v0.3.11/LectureRelay_0.3.11_x64-setup.exe.sha256)

运行新安装包即可升级，课堂资料和已下载模型会保留。Release 附件来自 GitHub 干净 Windows 构建；源码版本、资源校验和安装包哈希记录在随附的 `build-metadata.json` 中。

1. 在 Release 页面的 **Assets** 中下载 **`LectureRelay_0.3.11_x64-setup.exe`**。普通用户无需下载 **Source code** 源码压缩包。
2. 运行安装程序，按提示完成安装。若电脑缺少 Microsoft WebView2，安装器会联网下载。
3. 从开始菜单或桌面快捷方式打开 **LectureRelay**。
4. 进入 **设置 → 首次设置**，按清单完成配置。到 **AI 与模型 → 本地模型** 下载 **Nemotron**，用于英文字幕；需要本地翻译时再下载 **Hy-MT2**，返回首次设置启用相应字幕。模型只需下载一次，所有课程共用。
5. **新建课程**，选择中文、日语或韩语作为辅助语言，补充课程背景和专业术语。
6. 线下上课选择 **麦克风**；电脑播放课程时选择 **系统声音**。确认设备能够接收到声音，再开始录音。

安装包适用于 **64 位 Intel／AMD Windows 电脑**，无需独立显卡。使用安装版不需要 Node.js、pnpm、Rust、Python、Ollama 或 FFmpeg。模型需要首次联网下载，下载完成后，本地识别与翻译可以离线运行。

目前是尚未签名的开发预览版，Windows 可能显示“未知发布者”提示。GitHub 仓库目前为私有仓库，下载 Release 需要仓库访问权限；安装后的应用本身不要求登录。

## 从上课到复习

- **课前准备：** 按课程整理资料，填写背景与术语，选择声音来源、设备和字幕方式。
- **课堂使用：** 查看英文原文和译文，向上翻看前文，点击 **回到最新字幕** 继续跟随。支持暂停、恢复录音；关闭 **独立字幕窗** 不会结束课堂。
- **课后回看：** 播放录音，点击时间戳定位，搜索、修订转录，补全缺失译文，导出文本、字幕和笔记。
- **整理知识：** 导入支持的音视频文件，附加 PDF 课件，保存带时间戳的笔记、书签和章节。按需生成课后要点、AI 草稿、整堂复习指南或带原文引用的回答。手写笔记与 AI 历史版本分别保存。
- **外观与存储：** 切换浅色／深色主题，使用全局 **安静模式（Quiet Mode）**。支持单独删除一节课堂记录、恢复回收站中的课程，以及确认后永久删除或清空课堂数据与模型。

详细操作见 [开始使用](docs/user-guide/getting-started.md) 和 [本地 AI 配置](docs/user-guide/local-ai.md)。

设置分为六类：**通用** 管理外观和安静模式，修改后自动保存；**声音与字幕** 管理声音设备和字幕样式；**AI 与模型** 集中功能设置、本地模型与实时总结。API Key 位于折叠的 **功能设置 → 云端 API Key** 中。其他偏好有改动时才显示保存栏。

## AI 如何工作

英文识别、翻译、课后学习工具与实时总结分别配置。LectureRelay 不提供共享 API Key，也不运营推理服务器。

| 用途                     | 本地模型或服务                           | 运行时机                            |
| ------------------------ | ---------------------------------------- | ----------------------------------- |
| 英文转录                 | Nemotron Streaming EN 0.6B               | 录音期间                            |
| 翻译                     | Hy-MT2-1.8B Q4_K_M；也可选择 Qwen3.5-4B  | 上课期间，或课后按需补全            |
| 课后总结、深度复习与问答 | Qwen3.5-4B Q4_K_M，使用 Unsloth 转换版本 | 实时处理结束后，由用户发起          |
| 实时分段总结             | Groq 或 OpenAI，使用用户自己的 API Key   | 可选开启，每 2、4 或 5 分钟整理一次 |

按需下载即可：Nemotron 约 **667 MiB**，Hy-MT2 约 **1,081 MiB**，Qwen 约 **2,614 MiB**。全部下载约占 **4.3 GiB**，录音和应用文件另计。本地推理没有按次 API 费用，但会使用你电脑的内存、存储与电力。

**安静模式**为本地 AI 设置共享 CPU 预算；关闭后允许使用应用可用的全部 CPU 核心。字幕速度、风扇噪音和功耗仍取决于设备。本地 AI 失败时，不会自动改用云端服务。

### 可选实时总结

课堂右侧可以将新定稿英文整理成简短卡片，保留时间范围、原文引用和回听入口。**Groq 是优先提供的可选服务**，初始模型为 `openai/gpt-oss-120b`；也可以使用 OpenAI。更换总结服务不会改变英文识别或翻译设置。

**获取 Groq API Key → 粘贴并保存 → 测试总结连接 → 确认文字上传 → 启用实时总结**

入口为 **设置 → AI 与模型 → 实时总结**。

实时总结默认关闭，启用后默认每 **4 分钟**整理一段，也可选择 **2 分钟或 5 分钟**，或手动整理当前内容。只有点击 **加入我的笔记**，才会将卡片要点追加到笔记草稿。录音保存独立于总结任务；失败或未完成的片段会显示状态，供稍后重试。

为降低课堂资源占用，实时总结只使用云端服务，且需要明确完成设置后才能启用；课后复习与问答仍可使用本地 Qwen。

云端总结会发送所选英文片段，以及有限的课程背景和术语，不上传录音。API Key 只在应用中填写，使用 Windows Credential Manager 保存。Groq 免费账户有请求与 tokens 限额；OpenAI API 单独计费，ChatGPT 订阅不包含 API 用量。额度与费用由用户自己的服务商账户承担。

配置说明见 [实时课堂总结](docs/user-guide/live-summaries.md) 和 [AI 服务设置](docs/providers/setup.md)。

## 当前质量与测试范围

LectureRelay 仍处于开发预览阶段。英文转录可能漏词，翻译可能误解术语或否定句，AI 总结也可能曲解课堂内容。**引用能够跳回原文，并不代表结论一定正确。** 复习重要内容时，请保留原文与录音作为核对依据。

普通笔记本的功耗、噪音以及实际设备断开场景仍待验证。每个版本实际做过哪些测试，记录在对应的 [发布说明](docs/releases/v0.3.11.md) 中；测试分层与验收方法见 [验证说明](docs/testing/validation.md)。

## 数据与隐私

- **数据库、模型、检查点与应用状态：** `%LOCALAPPDATA%/LectureRelay/`。
- **录音和课堂资料：** Windows“文档”已知文件夹中的 `LectureRelay/Courses/`；导出文件位于 `LectureRelay/Exports/`。
- **API Key：** 在应用密码输入框中填写，并保存到 Windows Credential Manager。请勿放进聊天、`.env`、测试脚本、日志或导出文件。

卸载应用会保留课堂资料。备份前请退出应用，并同时备份数据库和资料库。本地课堂文件没有应用层加密。更多说明见 [安全说明](SECURITY.md) 和 [原生运行时许可与来源](docs/licenses/native-runtime.md)。Windows 签名与项目整体源码许可证仍待完善。

## 参与开发

以下内容仅供开发者使用，**普通用户安装 EXE 无需执行这些步骤**。如需复现已发布安装版，请检出对应 tag，例如 `v0.3.11`；默认分支和功能分支可能与 Release 不同。

项目使用 Tauri 2、React、TypeScript、Rust、SQLite 和原生语音 worker。开发环境需要 Windows x64、Node 24.15.x、pnpm 11.25.0、Rust 1.98.1 MSVC、C++ Build Tools／Windows SDK 与 WebView2。

```powershell
pnpm run setup
pnpm run doctor
pnpm dev
```

| 命令                                          | 用途                          |
| --------------------------------------------- | ----------------------------- |
| `pnpm dev:web`                                | 前端预览；原生功能需要 Tauri  |
| `pnpm check:web`、`pnpm build:web`            | 类型检查与前端生产构建        |
| `pnpm test:rust`、`pnpm lint:rust`            | 常规原生测试与 Clippy         |
| `pnpm test:components`                        | 隔离的真实 React 组件回归     |
| `pnpm format:check`、`pnpm format:rust:check` | 格式检查                      |
| `pnpm verify:repo`、`pnpm verify:resources`   | 仓库与运行时检查              |
| `pnpm build:debug`                            | 原生调试版 EXE                |
| `pnpm release`                                | 生成 Windows 安装包与校验文件 |

首次构建会获取固定版本的 CPU 运行时；模型权重仍通过应用单独下载。安装包按当前配置版本输出到 `target/x86_64-pc-windows-msvc/release/bundle/nsis/`。构建产物不提交到 Git，通过 Release 附件分发。

参见 [开发环境](docs/development/environment.md)、[贡献指南](CONTRIBUTING.md)、[仓库结构](docs/architecture/repository-structure.md)、[架构说明](docs/architecture/overview.md) 和 [CI 说明](docs/development/ci.md)。
