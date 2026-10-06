# Local AI (0.3 preview)

In the 0.3.7 candidate, the right-hand **课堂要点** tab collects finalized classroom captions into sections. After stopping and waiting for remaining captions to finish, click **生成课堂要点** to summarize them locally with the downloaded Qwen3.5-4B study model. Click a time range to replay, expand the source to check a claim, or use **加入我的笔记** to append the section to your existing draft. Incomplete runs retain completed sections and offer **继续整理**. Live recording does not run the study model. See [summary validation](../testing/classroom-summary-v0.3.7.md).

In the 0.3.6 candidate, local translation can show a stable-prefix preview before a sentence is final. **临时译文 · 将随原文调整** marks provisional text; **翻译中…** marks a final sentence whose translation is still being generated. Only completed translations enter saved records and exports. Model loading and long sentences still need time. See [real lecturer audio validation](../testing/local-caption-latency-v0.3.6.md).

Install the Windows EXE. No LectureRelay login, API key, Python, Ollama or developer tools are needed for the local path. Internet is needed for the first model downloads; inference then runs on your computer. Model storage and electricity are yours; LectureRelay does not pay for hosted inference.

1. Open **Settings → Local AI** and download the models you need. Downloads show progress, can be cancelled, and are checked against pinned SHA-256 hashes.
2. In **AI Providers**, select **Local English** for speech, **Local** for translation and **Local** for summary/review. Save changes. Fresh text settings use Local; an existing explicit cloud selection is preserved on upgrade.
3. Add course background and a glossary in the course's target language. Record microphone or system audio. English captions are saved before translations. A missing or failed translation never stops the audio recorder.
4. Stop recording. **Recording saved** appears while remaining captions/translations finish. You can play the audio or cancel processing. Deferred translations can be filled with **Translate missing** later.
5. Open the saved lecture. **Generate AI draft** summarizes it. **Notes → Review the whole class** accepts your review instructions and processes every transcript section. Results appear under **Saved versions**, preserving manual notes. Q&A retrieves selected excerpts and includes source links; it is not the same as full-class review.

| Function                                   | Model                                  | Download  |
| ------------------------------------------ | -------------------------------------- | --------- |
| English transcription                      | Nemotron Streaming EN 0.6B Q8          | 667 MiB   |
| Translation candidate                      | Hy-MT2-1.8B Q4_K_M                     | 1,081 MiB |
| Summary, review, Q&A; optional translation | Qwen3.5-4B Q4_K_M (Unsloth conversion) | 2,614 MiB |

All three need about **4.3 GiB** of disk space plus app files and recordings. Working memory is additional. A GPU is not required. Downloads are optional and independent; Qwen translation and study tools reuse the same file.

**Quiet Mode** makes all local AI share at most four logical CPUs. Turning it off allows all CPUs available to the app. Running processes receive the affinity change immediately; a text worker's thread pool is refreshed on its next request. Models are released when their task finishes or is cancelled. Post-class study waits until recording and live processing finish.

These are **preview candidates**, not accuracy-certified defaults. The small evaluation found Hy-MT2 faster than Qwen but also found Japanese terminology and Korean negation mistakes. Qwen is available as an alternative translation model. Keep the original English visible and check important claims against timestamps. Neither candidate has passed an ordinary-laptop power/noise test or a new 90-minute full-app test with local translation.

Bergamot remains a development comparison only: the independently sourced engine produced poor technical translations and failed on the tested Korean model. No CourseDude executable, model wrapper or private service is distributed.

Cloud processing is optional and must be selected explicitly. There is **no automatic fallback to cloud**. See [provider settings](../providers/setup.md) for your own-key options and [evaluation evidence](../testing/local-ai-v0.3.md).
