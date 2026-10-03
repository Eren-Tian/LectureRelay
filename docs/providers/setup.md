# Providers — v0.2.0

Recording, replay, manual transcripts/notes and exports need no key. **None** is the initial speech/text choice. **Local** speech works offline after downloading Recommended; local translation, generated notes and Q&A are unavailable.

Speech and text providers are independent, for example Local speech with OpenAI text. Choose them under **Settings → AI Providers**. **Security & Privacy** has a separate key-provider selector, so a key can be saved before changing processing selections. Save keys only in the app password field; Windows Credential Manager stores them and later status returns a masked suffix. “Key saved” does not mean that a connection or model has been verified.

| Capability    | Local                  | OpenAI                      | Groq                             |
| ------------- | ---------------------- | --------------------------- | -------------------------------- |
| English STT   | Nemotron Streaming CPU | `whisper-1`                 | `whisper-large-v3-turbo`         |
| Live behavior | Native partials/finals | Rolling WAV requests        | Rolling WAV requests             |
| Text tasks    | Unavailable            | Selected chat model         | Selected compatible chat model   |
| API           | Offline inference      | `https://api.openai.com/v1` | `https://api.groq.com/openai/v1` |

Editable text defaults remain `gpt-4o-mini` and `llama-3.3-70b-versatile`. Connection testing lists models/checks text-model access, without proving speech access or running generation. Availability and billing follow the account.

Select providers/audio and download before class. Missing speech keys/models explain the required fix before starting. Choose None for recording alone. Downloads, heavy post-class work and connection tests are blocked during recording/live work. Later recognition errors leave capture active.

**Translate during class** sends finalized English plus bounded course context/glossary to your selected text provider, using the course's Chinese/Japanese/Korean assistance language. Fresh preferences enable this switch but leave the provider disconnected; existing preferences retain their saved switch value. A provider and key are required before any cloud translation runs. English saves first; pending, unavailable and retryable translations are shown explicitly below it. Choosing cloud speech authorizes disclosed audio uploads. None processing or local speech with translation off sends no lecture content to a provider.

Post-class STT uses at most 60-second cloud WAV or 30-second local chunks and saved cursors. Missing timestamps use coarse spans. Translation fills blanks; notes process bounded text; Q&A uses bilingual keyword retrieval and saves reference snapshots. Retrieval is not semantic search or guaranteed complete coverage. Cancellation is cooperative; post-class in-flight requests can last 120 seconds. Live translation drain can delay readiness after Stop.

Hosts are fixed, redirects/custom URLs disabled and provider errors sanitized. Adapters follow [OpenAI STT](https://developers.openai.com/api/docs/guides/speech-to-text), [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) and [Groq STT](https://console.groq.com/docs/speech-to-text). **No valid key was supplied; authenticated STT, translation, notes and Q&A remain unverified end to end.**
