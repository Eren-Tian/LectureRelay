# 真人讲者音频测试

识别准确率、字幕延迟、翻译延迟和真实课堂性能验收使用 **TED 或大学开放课程的真人讲者音频**。后续不使用机器朗读音频来证明这些指标。已有机器朗读测试保留其原始范围，不重新标成真人课堂证据。

- 优先从官方课程或演讲页面取得公开提供的素材。记录讲者、课程、原始链接、截取时间和 SHA-256。
- 测试素材与完整转录保留在忽略的 `target/` 中；不加入产品安装包、Git 仓库或 Release 附件。按来源条款使用，保存出处。
- 前后对照使用相同原始片段、音量、输入设备、Quiet Mode、模型、课程背景和术语。只允许记录在案的截取、混声道和重采样，不加速，不替换声音。
- 清楚区分首次英文出现、临时译文首次出现、最终译文完成、识别积压和整句定稿等待。首个 token、队列年龄或模型计算时间不等于逐词声音到上屏延迟。
- 实际录音测试期间不并发编译或运行重型基准。仍需单独验证普通笔记本、麦克风环境与长时课堂；当前台式机的短片段不能替代这些验收。

纯状态、IPC、故障和组件回归可以使用固定文本与合成响应，因为这些测试不声称真实声音质量或课堂性能。若故障回归需要播放声音，也使用真人讲者素材。

本次采用 [MIT OCW 9.00 Introduction to Psychology，Fall 2004，Lecture 1](https://ocw.mit.edu/courses/9-00-introduction-to-psychology-fall-2004/resources/mit9_00f04_lec01_trimmed_mp4/)，讲者 Jeremy Wolfe。原始音频 01:00–02:30 截取为 90 秒、mono 16 kHz PCM16。没有 TTS 或语速修改。来源、转换和哈希保存在 `target/local-latency/audio/provenance.json`。素材遵循 [MIT OCW 使用条款](https://ocw.mit.edu/pages/privacy-and-terms-of-use/)，仅用于本机内部验证。
