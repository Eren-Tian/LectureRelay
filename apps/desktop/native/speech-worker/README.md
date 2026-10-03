# Production Nemotron speech worker

`src/main.cpp` is the controlled Windows C++17 worker used by `src-tauri/src/speech/local/worker.rs`. `runtime.json` identifies the pinned CPU SDK and the exact DLL set. Experimental engines and the pre-glossary soak policy live under `experiments/local-stt`, never in this production directory.

Build with `pnpm build:asr`. MSVC `/O2 /MT` compiles from source; no CMake wrapper or vendored SDK is needed for this small worker. The official archive is SHA-256 checked before extraction.

| Role                       | Location                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| Source                     | `apps/desktop/native/speech-worker/src/main.cpp`                     |
| SDK/archive                | `target/native/speech-worker/{nemo,*.zip}` (ignored)                 |
| Worker/object/build driver | `target/native/speech-worker/` (ignored)                             |
| Tauri packaging inputs     | `apps/desktop/src-tauri/resources/local-asr/` (ignored/rebuilt)      |
| Installed runtime          | `<install-directory>/local-asr/`                                     |
| License sources            | Full upstream SDK license tree plus `docs/licenses` model PDF/NOTICE |

The adapter starts a hidden child with a kill-on-close Windows Job Object and a 30-second response timeout. Messages/replies are bounded. DLL search is restricted to its runtime and Windows system directories. The Rust parent owns the global performance policy: Quiet Mode permits up to four available logical processors; disabling it restores the app's full available CPU mask. Changes also update running live and post-class workers without restarting their recognition streams. This limits runnable CPUs, not the number of software threads. The standalone C++ helper does not impose a separate cap. No Python/CUDA/weights are bundled.

## Protocol (unchanged)

Stdin uses little-endian u32 headers: high two bits select batch (0), feed (1), flush (2), or glossary (3); lower 30 bits contain float32 mono-16k sample count or glossary byte count. Header 0 closes the worker. Glossary payload is NUL-delimited UTF-8, at most 16 KiB/64 terms. Replies are i32 code + u32 UTF-8 byte length + payload, at most 20,000 bytes. Streaming replies contain `text`/`final`; partials remain provisional. Batch returns text. The persistent recognizer uses 160 ms blocks, 500 ms quiet detection and 20-second endpoints.

The audited nine-DLL import closure starts at `nemo_speech_asr_c.dll`: ASR, ggml/base/CPU, MSVC C++/VCRuntime and OpenMP. Windows OS/UCRT imports are system dependencies. NMT/TTS/llama and unused SDK redistributables are excluded; the full upstream notice tree is intentionally retained. Change this list only after checking PE imports, dynamic loading and an actual model smoke. See [provenance](../../../../docs/licenses/native-runtime.md).
