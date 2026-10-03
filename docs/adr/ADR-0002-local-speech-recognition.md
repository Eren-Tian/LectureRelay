# ADR-0002: Native local English speech recognition

Date: 2026-09-30. Status: accepted for v0.2 preview; full classroom acceptance pending.

## Context

LectureRelay needs genuine live English captions on Windows without an end-user Python, pip, Conda, PyTorch or CUDA installation. Recording must survive STT failure. Resource use, session reliability, context support and reproducible distribution outweigh small accuracy differences.

## Evidence and candidates

The [benchmark report](../testing/local-stt-benchmark-v0.2.md) covers actual Nemotron, Moonshine, Parakeet and Whisper runs; Qwen3-ASR and Fun-ASR were investigated only. The five-clip corpus is 95 seconds/175 words, mostly synthetic, and cannot establish general lecture accuracy.

Nemotron native CPU achieved 6.29% WER, approximately 943 MiB RAM and 526 ms computation per two-second feed on the development machine. A 5400.6-second native/WAV/SQLite soak completed without errors or duplicate saves. Moonshine used less memory but the tested reused-session path failed around 200 seconds and forced endpoints lost words. Parakeet matched selected native WER on this small set. Whisper tiny.en was lightweight but is not a genuine streaming architecture. Current secondary native ports are viable research paths, but streaming/hotwords/packaging remain unaccepted; Fun converted-artifact licensing also needs resolution.

## Decision

Ship one **Recommended** option: official Nemotron Streaming EN 0.6B Q8_0 using NeMo-Speech.cpp 0.1.0. Use it for both live captions and post-class catch-up. Do not expose Quiet or High Accuracy as functioning options. Keep Parakeet refinement experimental until a larger natural corpus and explicit transcript-version workflow justify it.

Use a hidden C++ process loading the SDK C API behind Rust speech adapters. Bounded binary I/O, 30-second timeouts, restricted DLL search and a Windows kill-on-close Job Object contain failure. Retain genuine engine streaming state, two-second app ingress, 160 ms engine blocks, simple silence/20-second endpoints and coarse app spans. Limit worker affinity to four available logical processors; do not claim ordinary-laptop suitability or a fan-noise guarantee from this machine.

The model manager globally installs a pinned official revision with size/SHA verification, progress/cancel/remove and runtime metadata. No weight download occurs during a lecture. Bundle native CPU runtime/notices, not weights or CUDA/Python. Keep model license/notice beside downloaded weights. Installed-state checks validate metadata/size, without repeated full-file hashing.

Course source glossary terms use native RNNT speech contexts at boost 3, bounded to 64 phrases. The measured set showed no benefit; UI/documentation must not promise improved terminology. Cloud translation still receives bounded course context/glossary separately.

Recording remains authoritative. Native crash/load failure/timeout stops captions while the independent WAV writer continues. Caption history and translation queues are bounded; backlog stays on disk and unfinished audio can be processed after class. Do not automatically switch to a paid cloud provider.

Finals preserve stable IDs/provider/version; manual edits retain prior text via a database trigger. v0.2 adds provenance but no refinement version selector or edit-history browser, and does not overwrite a complete live transcript in an automatic second pass.

## Consequences and follow-up

October 2 update: the four-CPU affinity policy is now the default **Quiet Mode** setting. Users can disable it globally to restore the app's full available CPU mask, including on existing workers, without restarting recording. The packaged backend remains CPU-only. See the [preferences acceptance](../releases/v0.2.0-preferences.md).

This adds approximately 667 MiB model storage and roughly 1 GiB active native RAM on the tested machine. NVIDIA's model license is conditional open-weight licensing, not a permissive source license; retain the supplied license/notice and review changes before future redistribution. Runtime transitive notices remain bundled.

Full UI model-download/live-caption acceptance, authenticated cloud translation and a 90–180-minute real-device/full-UI classroom run remain release acceptance work. Future Quiet candidates must pass repeated-session tests on ordinary laptops. Future refinement must preserve selectable live/final versions and manual edits. CUDA remains experimental and optional rather than a system requirement.
