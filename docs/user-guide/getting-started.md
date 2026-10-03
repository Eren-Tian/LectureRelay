# Classroom use

Install the v0.2.0 current-user NSIS preview; WebView2 is required. End users do not need development tools, Python, CUDA, FFmpeg or external SQLite.

1. Create a course, choose Chinese/Japanese/Korean assistance and add course context/glossary terms.
2. For offline English captions, open **Settings → Local AI**, download the model, then choose **Local English** under **AI Providers → Speech recognition**. Download before class; the global model is shared across courses.
3. Start a lecture with **Microphone** or **System Audio**. System Audio captures other apps playing through the selected Windows output device. Combined microphone/system mixing is unavailable.
4. Watch English captions, pause/resume and **Stop & save**. For bilingual captions, choose a cloud text provider and enable **Translate during class** in **Settings → AI Providers**; enter your key only in **Security & Privacy**. Finalized English is translated into the course language below each paragraph. Scrolling up preserves your reading position; **Jump to Live** returns to the newest caption. Font sizes, visibility and automatic following are under **Live Captions**.
5. Replay and seek audio, correct the transcript, edit notes, and export Markdown/JSON. Remaining audio can be transcribed after class. Optional translation, generated notes and evidence-based Q&A use your own cloud text provider key.

The default speech/text selections are **None**. Recording/manual work remains available without a model/key. Local speech failure leaves recording running; missing prerequisites are explained before start. There is no automatic provider fallback or in-class model download.

See [local speech](local-speech.md), [provider setup](../providers/setup.md), [data locations](../architecture/overview.md) and [release limits](../releases/v0.2.0.md). Trash restores course indexes; uninstall keeps data. Back up database and library together after exiting. Content has no application-level encryption.
