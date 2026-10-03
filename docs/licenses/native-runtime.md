# Native runtime and binary provenance

No executable, DLL, model or installer is a source-controlled input. All were generated/downloaded into ignored build/cache/staging directories. The repository currently has no commits; this audit concerns versionable working-tree inputs, not an unavailable historical commit inventory.

| Binary input retained in source | Origin/purpose                                                                   | License/provenance                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tauri PNG/ICO                   | Generated copies of the original LectureRelay phoenix; required build/NSIS icons | Project artwork; canonical SVG in `assets/branding/phoenix`; project-wide license pending |
| NVIDIA Open Model License PDF   | Unmodified model license included with runtime and installed weights             | NVIDIA Open Model License; official link retained in the benchmark                        |

The NVIDIA model NOTICE is also a preserved text packaging input. Historical model/runtime hash manifests and benchmark outputs remain in experiments; weights/audio/binaries remain ignored under `target/asr-evaluation`.

Production SDK: official [NeMo-Speech.cpp v0.1.0 CPU Windows x64 release](https://github.com/NVIDIA/NeMo-Speech.cpp/releases/tag/v0.1.0), archive SHA-256 `5e4ea81046012edcd77fd8848de8eefb5a4ba38cc26f52eb544ab184695a75d6`. `scripts/build/prepare-asr.mjs` validates the archive and extracts to `target/native/speech-worker/nemo`; the project C++ worker is rebuilt with MSVC. Previously verified experimental archives may be reused without moving or deleting them.

`apps/desktop/native/speech-worker/runtime.json` lists the nine required DLLs. PE import audit found the ASR C API→ASR→ggml/base/CPU→MSVC/VCRuntime/OpenMP closure. NMT, TTS, llama and extra unused redistributables have no production path and are no longer staged. Windows kernel/UCRT libraries are OS dependencies. The actual model/worker test verifies runtime loading with this reduced set.

NeMo source/runtime is Apache-2.0; the complete upstream LICENSE/NOTICE/THIRD_PARTY_NOTICES and dependency license tree travel with the package, including ggml, llama.cpp, miniaudio, cpp-httplib and vcpkg dependency notices. Retaining a notice does not mean every component's DLL is shipped. Microsoft runtime redistributables are unchanged upstream SDK files. Do not describe all optional upstream configurations as Apache-only: optional Flashlight/KenLM licenses differ and those paths are not enabled in this pinned artifact. See [benchmark licensing evidence](../testing/local-stt-benchmark-v0.2.md).

Nemotron weights are downloaded only by the application model manager: official pinned revision/size/hash, separate NVIDIA Open Model License conditions and required NOTICE. They are not bundled. Experiments with Moonshine, Parakeet, Whisper, Qwen/Fun remain development-only; preserve their documented provenance/licensing limits before considering distribution.

No dependency versions were upgraded. Node/Cargo application dependencies all have source/build references; only an unused workspace alias and an empty package reservation were removed. A project-wide source license remains an owner decision before public release.
