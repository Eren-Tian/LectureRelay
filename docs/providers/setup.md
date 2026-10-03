# AI providers — v0.3 preview

Select speech, translation and study processing independently under **Settings → AI Providers**. No LectureRelay account is needed. Fresh translation and study settings use **Local**; fresh speech starts as audio-only until you choose recognition. Upgrades retain an existing explicit cloud selection.

| Capability                      | Local                           | Optional OpenAI     | Optional Groq            |
| ------------------------------- | ------------------------------- | ------------------- | ------------------------ |
| English speech                  | Nemotron Streaming EN 0.6B, CPU | `whisper-1`         | `whisper-large-v3-turbo` |
| Translation                     | Hy-MT2-1.8B or Qwen3.5-4B, CPU  | Selected chat model | Selected chat model      |
| Summary, full-class review, Q&A | Shared Qwen3.5-4B, CPU          | Selected chat model | Selected chat model      |

Download local models once in **Local AI**. No key or per-request charge is involved. See [local setup and limitations](../user-guide/local-ai.md). Local errors stay local; they do not trigger a cloud request. The bundled CPU llama.cpp helper is bound to authenticated loopback only, with prompt logging disabled. The frontend has no direct network route to the helper.

Cloud modes require your own key, entered in the application's password field under **Security & Privacy**. Windows Credential Manager stores it. Status exposes only a masked suffix. Never put keys in scripts, chat, `.env`, SQLite, logs or exports. “Key saved” is not an inference test. Provider charges/quotas apply to your account; LectureRelay does not host inference or supply a shared key.

Cloud speech sends audio; cloud text sends transcript text and course context. Endpoints are fixed to `https://api.openai.com/v1` or `https://api.groq.com/openai/v1`; redirects/custom URLs are disabled. Editable cloud text defaults remain `gpt-4o-mini` / `llama-3.3-70b-versatile`; availability follows the provider account.

Translation saves English first and associates results with source revision and course language. Missing results can be retried after class. Full-class summaries/reviews process bounded sections and retain section notes when reducing long input. Q&A uses keyword retrieval with source snapshots; retrieval is not semantic search or guaranteed full coverage. Cancel local inference to terminate its helper. Stop recording saves audio independently of the translation queue.

Authenticated cloud workflows remain untested because paid cloud tests were excluded. Local evaluation is not a cloud acceptance test or an independent security audit.
