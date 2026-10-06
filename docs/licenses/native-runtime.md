# Native runtime and binary provenance

No executable, DLL, model or installer is a source-controlled input. All are generated/downloaded into ignored build/cache/staging directories. Historical audit statements below refer to the ASR runtime; the separate text runtime added in 0.3 is described at the end.

| Binary input retained in source | Origin/purpose                                                                   | License/provenance                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tauri PNG/ICO                   | Generated copies of the original LectureRelay phoenix; required build/NSIS icons | Project artwork; canonical SVG in `assets/branding/phoenix`; project-wide license pending |
| NVIDIA Open Model License PDF   | Unmodified model license included with runtime and installed weights             | NVIDIA Open Model License; official link retained in the benchmark                        |

The NVIDIA model NOTICE is also a preserved text packaging input. Historical model/runtime hash manifests and benchmark outputs remain in experiments; weights/audio/binaries remain ignored under `target/asr-evaluation`.

Production SDK: official [NeMo-Speech.cpp v0.1.0 CPU Windows x64 release](https://github.com/NVIDIA/NeMo-Speech.cpp/releases/tag/v0.1.0), archive SHA-256 `5e4ea81046012edcd77fd8848de8eefb5a4ba38cc26f52eb544ab184695a75d6`. `scripts/build/prepare-asr.mjs` validates the archive and extracts to `target/native/speech-worker/nemo`; the project C++ worker is rebuilt with MSVC. Previously verified experimental archives may be reused without moving or deleting them.

`apps/desktop/native/speech-worker/runtime.json` lists the nine required DLLs. PE import audit found the ASR C API→ASR→ggml/base/CPU→MSVC/VCRuntime/OpenMP closure. NMT, TTS, llama and extra unused redistributables have no production path and are no longer staged. Windows kernel/UCRT libraries are OS dependencies. The actual model/worker test verifies runtime loading with this reduced set.

NeMo source/runtime is Apache-2.0; the complete upstream LICENSE/NOTICE/THIRD_PARTY_NOTICES and dependency license tree travel with the package, including ggml, llama.cpp, miniaudio, cpp-httplib and vcpkg dependency notices. Retaining a notice does not mean every component's DLL is shipped. Microsoft runtime redistributables are unchanged upstream SDK files. Do not describe all optional upstream configurations as Apache-only: optional Flashlight/KenLM licenses differ and those paths are not enabled in this pinned artifact. See [benchmark licensing evidence](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/docs/testing/local-stt-benchmark-v0.2.md).

Nemotron weights are downloaded only by the application model manager: official pinned revision/size/hash, separate NVIDIA Open Model License conditions and required NOTICE. They are not bundled. Experiments with Moonshine, Parakeet, Whisper, Qwen/Fun remain development-only; preserve their documented provenance/licensing limits before considering distribution.

The 0.3 work does not upgrade Node/Cargo application dependencies. A project-wide source license remains an owner decision before public release.

## Text runtime and weights (0.3)

`scripts/build/prepare-text-runtime.mjs` obtains the official [llama.cpp b11366 Windows CPU x64 archive](https://github.com/ggml-org/llama.cpp/releases/tag/b11366), SHA-256 `33dbed3c969e394e2977105e89f5c4b5dbbb5233d038d14b6954b3d32bbde9ec`. Only the server, required CPU/common/model libraries and licenses are staged in `local-text`, separately from the ASR DLLs. The generated file manifest is checked before process launch and by installer verification. llama.cpp is MIT; LLVM OpenMP includes its upstream license. Model licenses travel with the installer and are copied next to downloaded weights.

- [Hy-MT2-1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF): Tencent's Q4_K_M GGUF, Apache 2.0. Revision `a0c709d9fac510f2c807aa3af52872340dc37a4a`, 1,133,080,448 bytes, SHA-256 `dc5f44fcf1fa496ee7ad725982c0c8c553a4de00259b53af84c4b89fb0c06699`.
- [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B): Apache 2.0 model. We use the explicitly attributed [Unsloth GGUF conversion](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF), not an official Qwen GGUF release. Revision `e87f176479d0855a907a41277aca2f8ee7a09523`, 2,740,937,888 bytes, SHA-256 `00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4`. The official model license is pinned to revision `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a`.

No vision projector is downloaded. These features generate text, not images. Weights are separate optional downloads; no per-call hosted inference is used. The independently installed fxtranslate package and Mozilla models under `target/local-ai-evaluation` are development-only comparison inputs, not product dependencies.
