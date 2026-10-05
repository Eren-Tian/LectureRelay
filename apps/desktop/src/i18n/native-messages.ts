// Native system messages only; never apply this catalog to classroom content.
export const nativeMessages: Record<string, string> = {
  'Live translation queue unavailable.':
    '暂时无法处理翻译队列，英文与录音会保留。',
  'Type DELETE to confirm permanent deletion.':
    '请在确认框中输入“删除”，确认永久删除。',
  'Type DELETE ALL to confirm freeing all class storage.':
    '请在确认框中输入“清空全部数据”，确认清理全部课堂资料与模型。',
  'Cannot safely start local speech worker.':
    '无法安全启动本地识别进程，请重启应用或重新安装 LectureRelay。',
  'Failed to fetch': '网络连接失败，请检查网络后重试。',
  'Invalid PDF structure.': 'PDF 文件结构无效，文件可能已损坏。',
  'Missing PDF "file.pdf".': '没有找到 PDF 文件。',
  'Incorrect Password': 'PDF 密码错误，请选择无需密码的文件。',
  'No password given': 'PDF 需要密码，请选择无需密码的文件。',
  'Stop and save the recording before transcription.':
    '请先结束并保存录音，再进行转录。',
  'Audio cannot be read. The recording may not have completed normally.':
    '无法读取录音，本次录音可能未正常结束。',
  'This recording format is not supported for transcription.':
    '暂不支持转录这种格式的录音。',
  'Invalid transcription timestamps or text. Saved content is preserved.':
    '转录文本或时间戳无效，已保存的内容会保留。',
  'No English segments need translation.': '所有英文段落都已有译文。',
  'Some translations are missing. English is preserved; run translation again.':
    '部分段落尚未翻译，英文原文已保留，请重新翻译。',
  'Transcript or target language changed. Old translations were discarded.':
    '原文或译文语言已修改，本次生成的旧译文未保存。',
  'Enter a question of no more than 2,000 characters.':
    '请输入问题，最多 2,000 字符。',
  'Split long transcript segments into shorter sections before asking a question.':
    '请先将过长的转录段落拆分，再进行提问。',
  'Choose a subtitle language.': '请选择字幕语言。',
  'No subtitles are available in this language.': '目前没有该语言的字幕。',
  'Another AI task is running. Wait or cancel it.':
    '另一个 AI 任务正在处理，请等待完成或先取消任务。',
  'Task cancelled. Saved results are preserved.':
    '任务已取消，已保存的结果会保留。',
  'The local PDF is missing or unreadable.':
    '无法读取本地 PDF，请检查文件是否被移动或删除。',
  'Choose a valid PDF smaller than 50 MiB.':
    '请选择有效的 PDF 文件，大小需低于 50 MiB。',
  'Choose a media file smaller than 2 GiB.': '请选择小于 2 GiB 的音视频文件。',
  'This media format is unsupported or damaged.':
    '文件格式暂不支持，或文件已经损坏。',
  'No supported audio track was found.': '文件中没有找到可用音轨。',
  'Unknown audio sample rate.': '无法确定音频采样率。',
  'This audio codec is unsupported.': '暂不支持这种音频编码。',
  'Media decoding failed. The original file was not changed.':
    '音视频解码失败，原文件未被修改。',
  'Audio is damaged or uses an unsupported codec.':
    '音频已损坏，或使用了暂不支持的编码。',
  'Changing audio format is unsupported.': '音轨中途改变了格式，暂不支持导入。',
  'Media exceeds the five-hour import limit.':
    '文件超过 5 小时的导入时长上限。',
  'The selected file contains no decodable audio.':
    '所选文件没有可解码的音频。',
  'The audio track ended unexpectedly. Original media is preserved.':
    '音轨意外结束，原文件会保留。',
  'The app is busy.': '应用正在处理其他任务，请稍候。',
  'The app is busy. Try again.': '应用正在处理其他任务，请稍后重试。',
  'Finish active work before importing media.':
    '请先结束当前录音或处理任务，再导入音视频。',
  'The transcript, course context, language or model changed. Saved sections remain available; start a new review to use the current source.':
    '转录、课程背景、语言或模型已修改。已整理的段落会保留；如需使用最新内容，请重新生成复习指南。',
  'Keep review instructions under 2,000 characters.':
    '复习要求请控制在 2,000 字符以内。',
  'Add or generate a transcript first.': '请先添加或生成转录文本。',
  'Review assembly is incomplete.': '复习指南尚未整理完成。',
  'A small review section still exceeds the model limit. Saved sections are preserved; retry or simplify the requested focus.':
    '拆分后的片段仍超出模型容量。已整理的内容会保留，请重试或简化复习要求。',
  'Source coverage is incomplete.': '仍有部分课堂原文尚未整理。',
  'Local AI reached its output limit. Completed review sections are saved; retry the remaining work.':
    '本地 AI 已达到本次输出上限。已整理的段落会保留，请继续处理剩余内容。',
  'The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected.':
    '录音设备报告声音中断，请检查录音完整性。设备未提供受影响的时长。',
  'The audio device returned an invalid format.':
    '录音设备返回了无效的音频格式。',
  'Invalid audio device. Select it again.': '录音设备无效，请重新选择。',
  'This audio format is unsupported. Choose another device.':
    '暂不支持此设备的音频格式，请选择其他设备。',
  'Audio device disconnected during the test.':
    '测试期间录音设备已断开，请重新连接。',
  'Another lecture is recording. Stop it first.':
    '另一节课正在录音，请先结束并保存。',
  'Audio startup timed out. Check the device and permissions.':
    '录音启动超时，请检查设备和 Windows 麦克风权限。',
  'This lecture is not recording.': '这节课当前没有在录音。',
  'Recording stopped. Save the lecture.': '录音已停止，请保存课堂记录。',
  'Recording already stopped.': '录音已经停止。',
  'Recording worker failed. Restart to recover saved audio.':
    '录音进程异常退出，请重启应用，恢复已保存的录音。',
  'No audio device found. Connect it and check Windows audio permissions.':
    '没有找到录音设备，请连接设备并检查 Windows 麦克风权限。',
  'Audio device unavailable. Connect it and refresh devices.':
    '录音设备不可用，请重新连接并刷新设备列表。',
  'Selected audio device': '所选录音设备',
  'This audio sample format is unsupported. Choose another device.':
    '暂不支持此设备的采样格式，请选择其他设备。',
  'Recording startup cancelled.': '已取消开始录音。',
  'Audio device disconnected or unavailable. Earlier audio is preserved.':
    '录音设备已断开或不可用，此前录音会保留。',
  'No sound detected. Check the audio source and volume.':
    '未检测到声音，请检查声音来源和音量。',
  'Recording could not finish normally. Saved audio will be recovered on restart.':
    '录音未能正常结束，重启应用后会恢复已保存的部分。',
  'Wait for live caption processing to finish.': '请等待实时字幕处理完成。',
  'Stop recording this course first.': '请先结束并保存这门课程的录音。',
  'A task is running for this course. Cancel it or wait for completion.':
    '这门课程有任务正在处理，请等待完成或先取消任务。',
  'Choose a valid audio source and device.': '请选择有效的声音来源和录音设备。',
  'Finish active recording or processing before testing audio.':
    '请先结束录音和处理任务，再测试声音。',
  'An audio test is already running. It finishes after five seconds.':
    '声音测试正在进行，5 秒后结束。',
  'Choose Microphone or System Audio.': '请选择麦克风或系统声音。',
  'Wait for the five-second audio test to finish before recording.':
    '请等待 5 秒的声音测试结束，再开始录音。',
  'Wait for caption processing or model download to finish.':
    '请等待字幕处理或模型下载完成。',
  'Download the local speech model in Settings → Local AI before class.':
    '上课前请先在“设置 → 本地 AI”下载语音模型。',
  'Add your speech provider key in Settings before class.':
    '上课前请先在设置中添加语音服务商的 API Key。',
  'Cancel or finish the AI task before starting a lecture.':
    '请先完成或取消当前 AI 任务，再开始录音。',
  'Another lecture is recording. Open that lecture to stop it.':
    '另一节课正在录音，请打开对应课堂，结束并保存。',
  'This recording is not active. Restart to recover its saved audio.':
    '这节课当前没有在录音，请重启应用，恢复已保存的录音。',
  'Wait for the AI task before editing the transcript.':
    '请等待 AI 任务结束，再编辑转录文本。',
  'Wait for active work before changing preferences.':
    '请等待当前录音或处理任务结束，再修改设置。',
  'Test provider connections after active work ends.':
    '请等待当前任务结束，再测试服务连接。',
  'Stop and save the lecture first.': '请先结束并保存录音。',
  'Stop and save the recording first.': '请先结束并保存录音。',
  'Wait for live captions or model download to finish.':
    '请等待实时字幕处理或模型下载完成。',
  'Run this AI task after recording ends.': '请在录音结束后运行此 AI 任务。',
  'Describe what you want to review.': '请填写希望重点复习的内容。',
  'This lecture has no notes yet.': '这节课还没有笔记。',
  'Storage usage is unavailable.': '暂时无法统计存储占用。',
  'Finish recording, processing, audio testing and downloads before deleting data.':
    '请先结束录音、AI 处理、声音测试和模型下载，再删除数据。',
  'Lecture deletion was interrupted. Restart to recover cleanup.':
    '课堂记录删除中断，请重启应用，恢复清理进度。',
  'Permanent deletion was interrupted. Restart to recover cleanup.':
    '永久删除中断，请重启应用，恢复清理进度。',
  'Storage cleanup was interrupted. Restart to recover cleanup.':
    '存储清理中断，请重启应用，恢复清理进度。',
  'Media import could not finish.': '音视频未能导入完成。',
  'Course document not found.': '没有找到课程文档。',
  'Stop and save recording before cancelling final processing.':
    '请先结束并保存录音，再取消剩余处理。',
  'Too many draft identifiers.': '一次检查的草稿数量过多。',
  'Lecture not found. Files will be restored.':
    '没有找到课堂记录，相关文件会恢复。',
  'Content deleted, but database compaction failed. Restart the app and try freeing storage again.':
    '内容已删除，但数据库未能压缩。请重启应用后再次清理存储。',
  'The course does not exist.': '这门课程不存在。',
  'Enter a valid course name, subject and assistance language.':
    '请填写课程名称，并选择学科和译文语言。',
  'The glossary term is empty or too long.':
    '请输入术语，并将长度控制在允许范围内。',
  'The glossary does not exist.': '这条术语不存在。',
  'Cannot save: this English term may already exist.':
    '保存失败，该英文术语可能已存在。',
  'Transcript data is damaged.': '转录数据已损坏。',
  'Check transcript content and timestamps.': '请检查转录内容和起止时间。',
  'Transcript segment does not exist.': '这段转录不存在。',
  'Notes are too long. Shorten them before saving.':
    '笔记过长，请精简后再保存。',
  'The answer sources is damaged.': '回答的引用数据已损坏。',
  'The recovery record is damaged.': '录音恢复记录已损坏。',
  'Enter a valid lecture title.': '请输入有效的本节课标题。',
  'The lecture does not exist.': '这节课堂记录不存在。',
  'This database requires a newer LectureRelay version. Upgrade the app.':
    '该资料库需要更新版本的 LectureRelay，请先升级应用。',
  'Database migration failed.': '数据库升级失败。',
  'Classroom migration failed.': '课堂数据升级失败。',
  'Study workspace migration failed.': '学习资料升级失败。',
  'Reliability migration failed.': '数据安全升级失败。',
  'Reliability migration failed its integrity check. Existing database was preserved.':
    '升级后数据未通过完整性检查，原数据库已保留。',
  'Database unavailable. Restart the app.': '数据库暂时不可用，请重启应用。',
  'Choose a supported local translation model.': '请选择支持的本地翻译模型。',
  'Choose Light or Dark appearance.': '请选择浅色或深色外观。',
  'Choose local, cloud or off for translation and study tools.':
    '请将翻译和学习工具设为本地、云端或关闭。',
  'Check your language, provider and caption preferences. Keep at least one caption language visible.':
    '请检查语言、AI 服务和字幕设置，至少保留一种字幕语言可见。',
  'Saved settings could not be read.': '无法读取已保存的设置。',
  'Saved review progress is invalid.': '已保存的复习进度无效。',
  'Saved review not found.': '没有找到已保存的复习指南。',
  'Review exceeds the supported size. Saved sections remain available.':
    '复习指南超过大小上限，已整理的段落会保留。',
  'All source sections covered. Saved as a new note version.':
    '全部课堂原文已整理，并保存为新的笔记版本。',
  'Processing failed. Saved audio and completed results are preserved.':
    '处理失败，录音和已完成的结果会保留。',
  'Cancelled. Saved results are preserved.': '已取消，已保存的结果会保留。',
  'Processing was interrupted. Resume from saved results.':
    '处理意外中断，可以从已保存的进度继续。',
  'Notes exceed the supported size.': '笔记超过大小上限。',
  'Draft exceeds the supported size.': '草稿超过大小上限。',
  'Draft could not be saved. Keep this window open.':
    '草稿未能保存，请保持当前窗口打开。',
  'Choose a valid timestamp and a short label.':
    '请输入有效的时间戳和简短的标记名称。',
  'Unknown local model.': '无法识别这个本地模型。',
  'Download models after the lecture and current task finish.':
    '请等待录音和当前任务结束，再下载模型。',
  'Another model is downloading. Wait or cancel it.':
    '另一个模型正在下载，请等待完成或先取消下载。',
  'Model download interrupted. Try again.': '模型下载中断，请重试。',
  'Model exceeds the expected size.': '模型文件超过预期大小，已停止下载。',
  'Model download cancelled.': '模型下载已取消。',
  'Model integrity check failed. Download again.':
    '模型未通过完整性校验，请重新下载。',
  'Remove models after active work finishes.':
    '请等待当前任务结束，再删除模型。',
  'Network error.': '网络连接异常，请检查网络。',
  'Authorization rejected. Check your API key and account permissions.':
    '认证失败，请检查 API Key 和账号权限。',
  'Model or endpoint unavailable. Check the model name.':
    '模型或服务接口不可用，请检查模型名称。',
  'Audio chunk exceeds the provider limit.': '录音片段超过服务商允许的大小。',
  'Provider quota or rate limit reached. Try again later.':
    '已达到服务商的额度或请求频率限制，请稍后重试。',
  'Provider unavailable. Try again later.': '服务商暂时不可用，请稍后重试。',
  'The provider could not process this request. Check the model, account and input.':
    '服务商无法处理本次请求，请检查模型、账号权限和输入内容。',
  'Provider response interrupted. Try again.': '服务商响应中断，请重试。',
  'Provider response exceeds the size limit.': '服务商返回的内容超过大小上限。',
  'Provider response could not be parsed.': '无法解析服务商返回的数据。',
  'This text exceeds the local model context. Shorten the requested focus or course background.':
    '文本超过本地模型的上下文容量，请精简复习要求或课程背景。',
  'This AI feature is off. Choose a model in Settings → AI Providers.':
    '此 AI 功能尚未启用，请到“设置 → AI 服务”选择模型。',
  'Local translation cancelled. Recording is preserved.':
    '本地翻译已取消，录音会保留。',
  'Live translation paused. English and audio are saved; translate missing sentences after class.':
    '实时翻译已暂停，英文转录和录音会保留，可在课后补全翻译。',
  'Translation deferred while English captions catch up. Saved text can be translated after class.':
    '已暂缓翻译，让英文识别先跟上；已保存的文本可在课后翻译。',
  'Checking and loading local model…': '正在检查并加载本地模型…',
  'Local AI could not load the model. Check available memory or reinstall the model. Recording is preserved.':
    '本地 AI 无法加载模型，请检查可用内存或重新下载模型。录音会保留。',
  'Local model loading timed out. Recording is preserved.':
    '本地模型加载超时，录音会保留。',
  'Generating on this computer…': '正在本机生成内容…',
  'Local AI request failed. Saved audio and text are preserved; retry or choose a smaller task.':
    '本地 AI 请求失败，已保存的录音和文本会保留。请重试，或缩小处理范围。',
  'Local AI response exceeds the limit.': '本地 AI 返回的内容超过大小上限。',
  'Local AI returned invalid data.': '本地 AI 返回的数据无效。',
  'Local AI did not complete its response. Saved results are preserved.':
    '本地 AI 未能完整生成内容，已保存的结果会保留。',
  'Local AI returned no text. Try again.': '本地 AI 未返回文本，请重试。',
  'Local AI connection stopped or timed out. Recording and saved results are preserved.':
    '本地 AI 连接中断或超时，录音和已保存的结果会保留。',
  'Local model or runtime is missing. Download again or reinstall the app.':
    '本地模型或运行库缺失，请重新下载模型或重新安装应用。',
  'Local model integrity check failed. Remove it and download again.':
    '本地模型未通过完整性校验，请删除后重新下载。',
  'Local AI runtime missing. Reinstall LectureRelay.':
    '本地 AI 运行库缺失，请重新安装 LectureRelay。',
  'Use Local English for transcription.': '请使用本地英文识别进行转录。',
  'Cloud AI reached its output limit. Completed review sections are saved; retry the remaining work.':
    '云端 AI 已达到本次输出上限。已整理的段落会保留，请继续处理剩余内容。',
  'The provider did not complete its response. Saved results are preserved.':
    '服务商未能完整生成内容，已保存的结果会保留。',
  'The provider returned no valid text. Check the model configuration.':
    '服务商未返回有效文本，请检查模型配置。',
  'Provider text exceeds the size limit.': '服务商返回的文本超过大小上限。',
  'Add a key for this provider in Settings.':
    '请先在设置中添加该服务商的 API Key。',
  'Invalid API key format. Add the key again.':
    'API Key 格式无效，请重新添加。',
  'Connected, but this text model is unavailable. Check the model and account permissions.':
    '已连接服务商，但所选文本模型不可用，请检查模型名称和账号权限。',
  'AI request failed or timed out. Check your network and try again.':
    'AI 请求失败或超时，请检查网络后重试。',
  'Transcription failed or timed out. Saved audio is preserved.':
    '转录失败或超时，已保存的录音会保留。',
  'Invalid timestamps in the provider response.': '服务商返回的时间戳无效。',
  'The provider returned no transcript.': '服务商未返回转录文本。',
  'Invalid translation response. English is preserved; try translation again.':
    '返回的译文无效，英文原文会保留，请重新翻译。',
  'Paste a valid API key without spaces or newlines.':
    '请粘贴有效的 API Key，不要包含空格或换行。',
  'Windows Credential Manager could not save the key.':
    'Windows 凭据管理器未能保存 API Key。',
  'The saved key is empty. Add it again.':
    '已保存的 API Key 为空，请重新添加。',
  'The saved key cannot be read. Add it again.':
    '无法读取已保存的 API Key，请重新添加。',
  'Windows Credential Manager could not read the key.':
    'Windows 凭据管理器无法读取 API Key。',
  'Windows Credential Manager could not remove the key.':
    'Windows 凭据管理器未能移除 API Key。',
  'Choose an AI provider and add a key in Settings.':
    '请先在设置中选择 AI 服务，并添加 API Key。',
  'Download the local speech model in Settings first.':
    '请先在设置中下载本地语音模型。',
  'Live translation timed out. English is preserved.':
    '实时翻译超时，英文原文会保留。',
  'English captions are behind. Audio is still being saved. Try Full performance; remaining text can be transcribed after class.':
    '英文字幕尚未跟上，录音仍在保存。可切换到全速模式，未完成的转录也可以在课后补全。',
  'Live transcription timed out. Recording continues.':
    '实时转录超时，录音仍在继续。',
  'Invalid live speech response. Audio is preserved.':
    '实时识别返回的数据无效，录音会保留。',
  'Translation unavailable. English is preserved.':
    '翻译暂时不可用，英文原文会保留。',
  'English is preserved': '英文原文会保留',
  'Some translations need another try. Your English and audio are saved; retry from lecture replay.':
    '部分译文需要重试。英文转录和录音已保存，可在回放页补全翻译。',
  'Invalid cleanup path. Nothing was deleted.':
    '清理路径无效，未删除任何文件。',
  'Storage contains a link or junction. Cleanup was stopped to protect files outside LectureRelay.':
    '存储目录中存在链接或目录联接。为保护应用之外的文件，已停止清理。',
  'Invalid cleanup scope. Files were preserved.': '清理范围无效，文件会保留。',
  'Content was deleted, but some files could not be freed. Restart LectureRelay to retry cleanup.':
    '内容已删除，但部分文件仍未清理。请重启 LectureRelay 后重试。',
  'Cleanup recovery found conflicting files. Keep both folders and restart after resolving the conflict.':
    '恢复清理时发现文件冲突。请保留两个文件夹，解决冲突后重启应用。',
  'Move this course to Trash before deleting it permanently.':
    '请先将课程移入回收站，再永久删除。',
  'Stop and save this lecture before deleting it.':
    '请先结束并保存这节课的录音，再删除记录。',
  'Cleanup destination already exists.':
    '清理目标目录已存在，请重启应用后重试。',
  'Cannot free storage while files are in use. Close external players and try again.':
    '文件正在被其他应用使用，请关闭外部播放器后重新清理。',
  'The test data folder must be an absolute path.':
    '测试数据目录必须使用绝对路径。',
  'LectureRelay is already running, or the app data folder is not writable.':
    'LectureRelay 已在运行，或应用数据目录没有写入权限。',
  'Speech preferences are busy.': '语音设置正在调整，请稍后重试。',
  'Local recognition stopped. Recording is preserved.':
    '本地识别已停止，录音会保留。',
  'Local speech response exceeds the limit.':
    '本地识别返回的内容超过大小上限。',
  'Local speech response interrupted.': '本地识别响应中断。',
  'Local recognition failed. Recording is preserved; transcribe after class.':
    '本地识别失败，录音会保留，可在课后重新转录。',
  'Local speech returned invalid text.': '本地识别返回的文本无效。',
  'Local recognition timed out. Recording continues; transcribe after class.':
    '本地识别超时，录音仍在继续，可在课后重新转录。',
  'Local speech stopped.': '本地识别已停止。',
  'Complete response': '生成完成',
  'Connection unavailable. Try again.': '连接暂时不可用，请重试。',
  'Model status refresh unavailable': '暂时无法刷新模型状态。',
  'Speech model status unavailable': '暂时无法读取语音模型状态。',
  'Trash unavailable': '暂时无法读取回收站。',
  'Controlled save failure': '保存失败，请重试。',
  'Connection timed out. Please try again.': '连接超时，请重试。',
  'Cannot resume transcription.': '无法继续转录。',
  'Cannot read recording.': '无法读取录音。',
  'Task status unavailable.': '暂时无法获取任务状态。',
  'Cannot inspect PDF.': '无法检查PDF。',
  'Cannot read PDF.': '无法读取PDF。',
  'Cannot read the selected media file.': '无法读取所选音视频文件。',
  'Cannot inspect media.': '无法检查音视频文件。',
  'Unsupported audio sample rate.': '暂不支持此音频采样率。',
  'Cannot create imported audio. Check disk space.':
    '无法创建导入的录音。请检查剩余磁盘空间。',
  'Cannot write imported audio. Check disk space.':
    '无法写入导入的录音。请检查剩余磁盘空间。',
  'Cannot save imported audio.': '无法保存导入的录音。',
  'Cannot finalize imported audio.': '无法完成保存导入的录音。',
  'Cannot identify review source.': '无法识别复习原文。',
  'Cannot list audio devices. Check Windows permissions.':
    '无法获取录音设备。请检查 Windows 麦克风权限。',
  'Cannot start audio capture. Check Windows audio permissions or choose another device.':
    '无法启动声音采集。请检查 Windows 麦克风权限，或选择其他设备。',
  'Cannot open this audio input. Check Windows audio permissions.':
    '无法打开录音设备。请检查 Windows 麦克风权限。',
  'Cannot start the audio test. Close apps holding the device.':
    '无法启动声音测试。请关闭占用该设备的应用。',
  'Recording status unavailable.': '暂时无法获取录音状态。',
  'Cannot start the recording worker.': '无法启动录音进程。',
  'Cannot open the audio device. Check the device and Windows permissions.':
    '无法打开录音设备。请检查设备及 Windows 麦克风权限。',
  'Cannot create the recording file. Check disk space and permissions.':
    '无法创建录音文件。请检查磁盘空间和目录权限。',
  'Cannot initialize the recording file.': '无法初始化录音文件。',
  'Cannot initialize WAV recording.': '无法初始化WAV 录音。',
  'Cannot save the WAV header.': '无法保存WAV 文件头。',
  'Cannot start audio capture. Close apps holding the device.':
    '无法启动声音采集。请关闭占用该设备的应用。',
  'Cannot resume the audio device. Earlier audio is preserved.':
    '无法恢复录音设备，此前录音会保留。',
  'Cannot write audio. Check available disk space.':
    '无法写入录音。请检查剩余磁盘空间。',
  'Cannot save audio. Check available disk space.':
    '无法保存录音。请检查剩余磁盘空间。',
  'Cannot save the recovery checkpoint. Check available disk space.':
    '无法保存录音恢复进度。请检查剩余磁盘空间。',
  'Cannot save the end of the recording.': '无法保存录音结尾。',
  'Cannot encode audio chunk.': '无法生成录音片段。',
  'Cannot check audio devices.': '无法检查录音设备。',
  'Cannot test the audio input.': '无法测试录音设备。',
  'Cannot start lecture recording.': '无法启动课堂录音。',
  'Cannot save the lecture. Written audio is preserved.':
    '无法保存课堂记录。已写入的录音会保留。',
  'Invalid subtitle format.': '字幕格式无效。',
  'Cannot encode transcript export.': '无法生成转录导出文件。',
  'Unsupported export format.': '暂不支持此导出格式。',
  'Invalid storage folder.': '存储目录无效。',
  'Cannot open File Explorer.': '无法打开文件资源管理器。',
  'Invalid audio source.': '声音来源无效。',
  'Cannot list audio devices.': '无法获取录音设备。',
  'Model status unavailable.': '暂时无法获取模型状态。',
  'Cannot create course documents folder.': '无法创建课程文档目录。',
  'Cannot attach course PDF.': '无法添加课程 PDF。',
  'Cannot read course PDF.': '无法读取课程 PDF。',
  'Cannot open the print dialog.': '无法打开打印窗口。',
  'Cannot show captions.': '无法显示字幕窗。',
  'Cannot open caption window.': '无法打开字幕窗。',
  'Cannot close captions.': '无法关闭字幕窗。',
  'Cannot check local drafts.': '无法检查本地草稿。',
  'Invalid draft identifier.': '草稿标识无效。',
  'Cannot check storage cleanup.': '无法检查存储清理。',
  'Cannot finish storage cleanup.': '无法完成存储清理。',
  'Cannot begin deletion.': '无法开始删除操作。',
  'Cannot delete course data. Files will be restored.':
    '无法删除课程数据。相关文件会恢复。',
  'Cannot delete course documents.': '无法删除课程文档。',
  'Cannot delete courses.': '无法删除课程。',
  'Cannot clear model records.': '无法清除模型记录。',
  'Cannot commit deletion.': '无法保存删除操作。',
  'Cannot commit deletion. Files will be restored.':
    '无法保存删除操作。相关文件会恢复。',
  'Cannot begin lecture deletion.': '无法开始课堂记录删除。',
  'Cannot delete lecture data. Files will be restored.':
    '无法删除课堂数据。相关文件会恢复。',
  'Cannot delete lecture.': '无法删除课堂记录。',
  'Cannot commit lecture deletion.': '无法保存课堂记录删除。',
  'Cannot commit lecture deletion. Files will be restored.':
    '无法保存课堂记录删除。相关文件会恢复。',
  'Cannot read course.': '无法读取课程。',
  'Cannot read course data.': '无法读取课程数据。',
  'Cannot save course.': '无法保存课程。',
  'Cannot delete course.': '无法删除课程。',
  'Cannot read Trash.': '无法读取回收站。',
  'Cannot restore course.': '无法恢复课程。',
  'Cannot read glossary.': '无法读取术语表。',
  'Cannot delete glossary.': '无法删除这条术语。',
  'Cannot read live captions.': '无法读取实时字幕。',
  'Cannot read transcript.': '无法读取转录文本。',
  'Cannot save transcript.': '无法保存转录文本。',
  'Cannot save transcript segments.': '无法保存转录段落。',
  'Cannot save transcription progress.': '无法保存转录进度。',
  'Cannot commit transcript segments.': '无法保存转录段落。',
  'Cannot save translation.': '无法保存译文。',
  'Cannot read notes.': '无法读取笔记。',
  'Cannot save notes.': '无法保存笔记。',
  'Cannot read answers.': '无法读取问答。',
  'Cannot encode answer sources.': '无法生成回答引用。',
  'Cannot save answers.': '无法保存问答。',
  'Cannot read recovery record.': '无法读取录音恢复记录。',
  'Cannot save audio source.': '无法保存声音来源。',
  'Cannot create the recording folder. Check permissions.':
    '无法创建录音目录。请检查目录权限。',
  'Cannot save lecture.': '无法保存课堂记录。',
  'Cannot read lecture.': '无法读取课堂记录。',
  'Cannot read lecture data.': '无法读取课堂数据。',
  'Cannot save lecture status.': '无法保存课堂状态。',
  'Cannot open the local database.': '无法打开本地数据库。',
  'Cannot initialize the database.': '无法初始化数据库。',
  'Cannot read database version.': '无法读取数据库版本。',
  'Cannot start database migration.': '无法启动数据库升级。',
  'Cannot save database version.': '无法保存数据库版本。',
  'Cannot commit database migration.': '无法保存数据库升级。',
  'Cannot start classroom migration.': '无法启动课堂数据升级。',
  'Cannot commit classroom migration.': '无法保存课堂数据升级。',
  'Cannot start study workspace migration.': '无法启动学习资料升级。',
  'Cannot commit study workspace migration.': '无法保存学习资料升级。',
  'Cannot prepare reliability migration.': '无法准备数据安全升级。',
  'Cannot start reliability migration.': '无法启动数据安全升级。',
  'Cannot verify migration.': '无法验证数据升级。',
  'Cannot commit reliability migration.': '无法保存数据安全升级。',
  'Cannot enable database integrity checks.': '无法启用数据完整性检查。',
  'Cannot repair import metadata.': '无法修复导入记录。',
  'Cannot recover processing tasks.': '无法恢复处理任务。',
  'Cannot save model metadata.': '无法保存模型信息。',
  'Cannot remove model metadata.': '无法移除模型信息。',
  'Cannot read settings.': '无法读取设置。',
  'Cannot encode settings.': '无法生成设置。',
  'Cannot save settings.': '无法保存设置。',
  'Cannot read saved reviews.': '无法读取已保存的复习指南。',
  'Cannot read review progress.': '无法读取复习进度。',
  'Cannot read saved review.': '无法读取已保存的复习指南。',
  'Cannot encode review progress.': '无法生成复习进度。',
  'Cannot save review progress. Previously saved sections are preserved.':
    '无法保存复习进度。此前整理的段落会保留。',
  'Cannot publish review.': '无法保存复习指南。',
  'Invalid review progress.': '复习进度无效。',
  'Cannot publish review version.': '无法保存复习指南版本。',
  'Cannot encode published review.': '无法生成复习指南。',
  'Cannot save published review.': '无法保存复习指南。',
  'Cannot commit published review.': '无法保存复习指南。',
  'Cannot save processing task. No request was sent.':
    '无法保存处理任务。尚未发送任何请求。',
  'Cannot save task progress.': '无法保存任务进度。',
  'Cannot save task outcome.': '无法保存任务结果。',
  'Cannot read processing history.': '无法读取处理历史。',
  'Cannot read tasks.': '无法读取任务记录。',
  'Invalid translation result.': '译文无效。',
  'Cannot save note version.': '无法保存笔记版本。',
  'Cannot clear draft.': '无法清除草稿。',
  'Cannot save bookmark.': '无法保存书签。',
  'Cannot remove bookmark.': '无法移除书签。',
  'Cannot read course documents.': '无法读取课程文档。',
  'Cannot read documents.': '无法读取文档。',
  'Cannot save course document.': '无法保存课程文档。',
  'Cannot read bookmarks.': '无法读取书签。',
  'Cannot read note history.': '无法读取笔记历史。',
  'Cannot read draft.': '无法读取草稿。',
  'Cannot save pin.': '无法保存置顶状态。',
  'Cannot search library.': '无法搜索资料库。',
  'Model manager unavailable.': '暂时无法获取模型管理。',
  'Cannot initialize model download.': '无法初始化模型下载。',
  'Cannot create model folder.': '无法创建模型目录。',
  'Cannot download model. Check your connection.':
    '无法下载模型。请检查网络连接。',
  'Model download unavailable.': '暂时无法连接模型下载服务。',
  'Cannot create model file. Check disk space.':
    '无法创建模型文件。请检查剩余磁盘空间。',
  'Cannot write model. Check disk space.': '无法写入模型。请检查剩余磁盘空间。',
  'Cannot save model.': '无法保存模型。',
  'Cannot install model.': '无法安装模型。',
  'Cannot save model license. Reinstall LectureRelay.':
    '无法保存模型许可证。请重新安装 LectureRelay。',
  'Cannot remove model.': '无法移除模型。',
  'Cannot check local model process.': '无法检查本地模型进程。',
  'Local tokenizer unavailable.': '暂时无法获取本地分词器。',
  'Invalid local token count.': '本地 token 数量无效。',
  'Cannot read local model. Check disk space and permissions.':
    '无法读取本地模型。请检查磁盘空间和目录权限。',
  'Invalid local AI runtime manifest.': '本地 AI 运行库清单无效。',
  'Invalid runtime manifest.': '运行库清单无效。',
  'Invalid runtime file name.': '运行库文件名无效。',
  'Invalid runtime checksum.': '运行库校验值无效。',
  'Cannot allocate a local AI connection.': '无法建立本地 AI 连接。',
  'Cannot read local AI connection.': '无法读取本地 AI 连接。',
  'Cannot initialize local AI.': '无法初始化本地 AI。',
  'Cannot initialize local AI client.': '无法初始化本地 AI 客户端。',
  'Cannot start local AI. Reinstall LectureRelay.':
    '无法启动本地 AI。请重新安装 LectureRelay。',
  'Unsupported translation language.': '暂不支持此译文语言。',
  'Cannot initialize a secure connection.': '无法初始化安全连接。',
  'Cannot reach the provider. Check your network connection.':
    '无法连接AI 服务商。请检查网络连接。',
  'Cannot encode audio upload.': '无法生成上传的录音。',
  'Cannot encode translation input.': '无法生成翻译输入。',
  'Unsupported provider.': '暂不支持此AI 服务商。',
  'Live caption status unavailable.': '暂时无法获取实时字幕状态。',
  'Diagnostics unavailable.': '暂时无法获取诊断信息。',
  'Live status unavailable.': '暂时无法获取实时识别状态。',
  'Unsupported live audio format.': '暂不支持此实时音频格式。',
  'Cannot read live audio checkpoint.': '无法读取实时录音进度。',
  'Cannot read live audio. Recording continues.':
    '无法读取实时录音。录音仍在继续。',
  'Speech provider unavailable.': '暂时无法获取语音服务。',
  'Cannot encode diagnostics.': '无法生成诊断信息。',
  'Cannot inspect storage for cleanup. Check permissions.':
    '无法检查待清理的存储目录。请检查目录权限。',
  'Cannot inspect storage.': '无法检查存储目录。',
  'Cannot inspect cleanup recovery.': '无法检查清理恢复进度。',
  'Cannot restore interrupted cleanup.': '无法恢复中断的清理操作。',
  'Cannot restore files after interrupted cleanup.':
    '无法恢复中断清理后的文件。',
  'Cannot finish cleanup recovery.': '无法完成清理恢复进度。',
  'Cannot read cleanup journal.': '无法读取清理日志。',
  'Invalid cleanup journal.': '清理日志无效。',
  'Invalid cleanup journal name.': '清理日志名称无效。',
  'Invalid cleanup destination.': '清理目标目录无效。',
  'Invalid course.': '课程无效。',
  'Invalid lecture.': '课堂记录无效。',
  'Cannot inspect course files.': '无法检查课程文件。',
  'Cannot prepare cleanup journal.': '无法准备清理日志。',
  'Cannot locate the Windows app data folder.':
    '无法定位Windows 应用数据目录。',
  'Cannot locate the Windows Documents folder.': '无法定位Windows 文档目录。',
  'Cannot create the app data folder. Check permissions.':
    '无法创建应用数据目录。请检查目录权限。',
  'Cannot create the library folder. Check Documents permissions.':
    '无法创建资料库目录。请检查 Windows 文档目录权限。',
  'Invalid course or lecture identifier.': '课程或课堂标识无效。',
  'Cannot create the lecture folder.': '无法创建课堂目录。',
  'Cannot encode lecture metadata.': '无法生成课堂信息。',
  'Cannot encode transcript.': '无法生成转录文本。',
  'Invalid local file path.': '本地文件路径无效。',
  'Cannot write a local file. Check disk space.':
    '无法写入本地文件。请检查剩余磁盘空间。',
  'Cannot write the file. Check available disk space.':
    '无法写入文件。请检查剩余磁盘空间。',
  'Cannot save file.': '无法保存文件。',
  'Cannot update the file. Check whether another app is using it.':
    '无法更新文件。请检查文件是否被其他应用占用。',
  'Cannot save lecture snapshot.': '无法保存课堂快照。',
  'Storage usage is unavailable. Check folder permissions.':
    '暂时无法获取存储统计。请检查目录权限。',
  'Cannot read available CPU resources.': '无法读取可用 CPU 资源。',
  'Cannot manage local speech performance.': '无法调整本地识别性能。',
  'Cannot check local speech worker.': '无法检查本地识别进程。',
  'Cannot change local speech performance.': '无法调整本地识别性能。',
  'Invalid local speech audio.': '本地识别音频无效。',
  'Unsupported local speech audio.': '暂不支持此本地识别音频。',
  'Cannot read local speech audio.': '无法读取本地识别音频。',
  'Local recognition unavailable.': '暂时无法获取本地识别。',
  'Local speech worker unavailable.': '暂时无法获取本地识别进程。',
  'Cannot start local speech recognition. Reinstall LectureRelay.':
    '无法启动本地语音识别。请重新安装 LectureRelay。',
  'Local speech input unavailable.': '暂时无法获取本地识别输入。',
  'Local speech output unavailable.': '暂时无法获取本地识别输出。',
  'Cannot set speech glossary.': '无法设置语音术语表。',
  'Invalid local streaming response.': '本地流式识别结果无效。',
  'Invalid local speech chunk.': '本地识别片段无效。',
  'Cannot contain local speech worker.': '无法限制本地识别进程。',
};
