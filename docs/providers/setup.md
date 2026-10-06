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

In 0.3.9, the user's saved Groq key passed the summary generation test and produced two MIT classroom cards. The second card passed a fresh-process retest in 1.1 seconds after fixing explicit TLS initialization; the earlier failed cold attempt never reached HTTP. Local Qwen also completed the same tail after restart. References and formatting passed, but some wording remained too literal or broader than the source: neither model has passed a full classroom accuracy evaluation. Other authenticated cloud speech, translation, OpenAI summary, postclass notes and Q&A workflows remain untested. See [live-summary acceptance](../testing/live-summaries-v0.3.9.md) for exact scope. Local evaluation and error-response tests are not an independent security audit.

## Independent live summaries (0.3.10)

Live summaries have a separate provider, model, interval and explicit transcript-upload consent. Groq is the preferred optional entry, defaulting to `openai/gpt-oss-120b`; OpenAI defaults to `gpt-4o-mini`. Local Qwen live summaries are disabled to reduce classroom power use. Previous local selections become Off on upgrade, with upload consent cleared; they never automatically switch to a cloud provider. Existing cards, speech, translation and manually requested postclass study settings are preserved. Gemini is deferred.

Use **设置 → 实时总结 → 获取 Groq API Key → 保存 Key → 测试总结连接 → 启用实时总结**. The key button opens <https://console.groq.com/keys>. The test performs real short generation and validates JSON and supplied reference IDs, rather than relying on `/models` access alone. Replacing the key or model invalidates the saved test status. Key storage and native HTTP handling reuse the existing Credential Manager and official provider adapter.

Groq GPT OSS requests use non-streaming strict JSON Schema, `max_completion_tokens`, `reasoning_effort: low` and `include_reasoning: false`; they do not also set `reasoning_format`. These capabilities are documented in [the model guide](https://console.groq.com/docs/model/openai/gpt-oss-120b), [structured outputs](https://console.groq.com/docs/structured-outputs) and [reasoning parameters](https://console.groq.com/docs/reasoning). Availability and factual quality must still be verified with the actual account and classroom evidence. Free account limits are shared at organization level; consult [rate limits](https://console.groq.com/docs/rate-limits) and your account. Do not describe it as unlimited free inference.

Only new finalized English and bounded course context/terms are uploaded for summaries, never the recording. Service retention exceptions and controls are described in [Groq's data policy](https://console.groq.com/docs/your-data); local default operation does not imply cloud data is never retained. See [the user guide](../user-guide/live-summaries.md) for cards and failure states, and the acceptance report for which real requests were actually executed.
