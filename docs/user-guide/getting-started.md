# Classroom use

Install the v0.3.0 Windows EXE preview; WebView2 is required and the installer offers to download it if missing. End users do not need development tools, Python, CUDA, Ollama, FFmpeg or external SQLite.

1. Create a course, choose Chinese/Japanese/Korean assistance and add course context/glossary terms.
2. For offline English captions, open **Settings → Local AI**, download the model, then choose **Local English** under **AI Providers → Speech recognition**. Download before class; the global model is shared across courses.
3. Start a lecture with **Microphone** or **System Audio**. System Audio captures other apps playing through the selected Windows output device. Combined microphone/system mixing is unavailable.
4. For bilingual captions, download **Hy-MT2** in **Local AI**, select **Local** translation and enable **Translate during class** under **AI Providers**. Qwen is an alternative translator. Finalized English is translated into the course language below each paragraph. Scrolling up preserves your reading position; **Jump to Live** returns to the newest caption. Caption controls are under **Live Captions**. See [local AI setup and quality limits](local-ai.md).
5. Pause/resume and **Stop & save**. Recording is saved first; any remaining AI work has a separate processing status. You can open the saved lecture or cancel remaining processing. Replay and seek audio, correct transcripts, and export Markdown/JSON or subtitles.
6. Download **Qwen** for local summaries, user-directed whole-class review and Q&A. Once live processing finishes, use **Generate AI draft**, **Notes → Review the whole class**, or **Questions**. AI drafts are saved as separate versions; manual notes are preserved.

Fresh installations default to audio-only speech and local text AI. Choose Local English after downloading the speech model. An existing explicit cloud text selection is preserved on upgrade. Recording/manual work remains available without any model or key. AI failures leave recording running; there is no automatic cloud fallback or in-class model download. Quiet Mode gives all local AI a shared budget of up to four logical CPUs.

See [local speech](local-speech.md), [optional own-key cloud setup](../providers/setup.md), [data locations](../architecture/overview.md) and [current evaluation limits](../testing/local-ai-v0.3.md). Trash restores course indexes; uninstall keeps data. Back up database and library together after exiting. Content has no application-level encryption.
