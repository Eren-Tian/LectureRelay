# Local STT experiments

Developer-only research and measurements for LectureRelay v0.2. Production is `apps/desktop/native/speech-worker/src/main.cpp` plus Rust speech adapters/model manager. No Python interpreter or benchmark script is packaged.

```text
benchmark-data/references.json   nonprivate ground-truth text
native/nemo-worker.cpp           preserved 90-minute worker-policy snapshot
scripts/                        discovery, download, synthesis, native CPU/CUDA and scoring
../../tests/soak/local-stt.py    opt-in native/WAV/SQLite soak
target/asr-evaluation/           ignored SDKs, large weights, WAVs, temporary DBs and outputs
```

Read [the benchmark](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/docs/testing/local-stt-benchmark-v0.2.md) before interpreting numbers. Only 95.3 seconds/175 words were scored, mostly synthesized speech. The paced 90-minute soak is a separate native/WAV/storage test. It is not a classroom/UI/provider endurance test.

## Reproduction

Run from the repository root on Windows with MSVC, Node and **developer Python 3.12** plus `psutil` available. Synthesis uses installed Microsoft David Desktop/System.Speech. `audioop` in the conversion script is intentionally a Python 3.12 development dependency; it is absent in Python 3.13. Large downloads go to the ignored cache.

```powershell
$env:PYTHONUTF8='1'
node experiments/local-stt/scripts/discover.mjs
node experiments/local-stt/scripts/download.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File experiments/local-stt/scripts/make-data.ps1
python experiments/local-stt/scripts/prepare-data.py
pnpm build:asr
python experiments/local-stt/scripts/native-bench.py nemotron > target/asr-evaluation/nemotron-results.jsonl
python experiments/local-stt/scripts/native-bench.py parakeet > target/asr-evaluation/parakeet-results.jsonl
python experiments/local-stt/scripts/native-bench.py moonshine > target/asr-evaluation/moonshine-results.jsonl
python experiments/local-stt/scripts/stream-bench.py nemo > target/asr-evaluation/nemotron-quiet-native-stream-results.jsonl
python experiments/local-stt/scripts/stream-bench.py nemo bias > target/asr-evaluation/nemotron-bias-native-stream-results.jsonl
python experiments/local-stt/scripts/whisper-bench.py > target/asr-evaluation/whisper-results.jsonl
python experiments/local-stt/scripts/score.py
python experiments/local-stt/scripts/term-score.py
```

Discovery is a **current-state research script**, not a frozen lockfile. For exact historical reproduction use revisions/hashes in the benchmark rather than a newer discovered release. `pnpm build:asr` always pins the production CPU SDK under `target/native/speech-worker`; native comparison/build scripts use it when the historical `asr-evaluation/nemo` cache is absent. Extract experimental transcribe.cpp 0.2.4 into `target/asr-evaluation/transcribe/transcribe-native-windows-x86_64-cpu-vulkan` and whisper.cpp **b5130** into `target/asr-evaluation/whisper` before their scripts; the current Whisper source tag differs from the measured binary baseline. The initial Moonshine batch evidence predates resource instrumentation: missing CPU/RAM remain null rather than being fabricated.

The Moonshine stream measurements used a preserved prototype binary in `target/asr-evaluation/moonshine-worker`, with 8-second forced endpoints/500 ms quiet detection, two CPU threads. That binary is deliberately not packaged. Its exact original prototype source was not retained as a complete rebuild recipe; the native header and binary remain in the local cache. Its measured results are kept in the [repository history](https://github.com/Eren-Tian/LectureRelay/blob/0c59144aa950e213def3c5f2b4df441bdcbffadc/experiments/local-stt/reports) as observed evidence, not claimed fully reproducible from checked-in source. The batch path is reproducible through the native SDK script.

CUDA is optional developer-only: run `download-cuda.mjs`, extract the pinned SDK into `target/asr-evaluation/nemo-cuda`, then `cuda-bench.py`. Do not compare global GPU utilization from other apps as this process's VRAM use.

For the preserved Nemotron policy snapshot:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File experiments/local-stt/scripts/build-nemo.ps1
$env:LECTURERELAY_SOAK_SECONDS='5400'
python tests/soak/local-stt.py
```

It waits actual wall time and writes WAV/SQLite/checkpoint/progress evidence under a timestamped cache directory. Translation queue work is delay simulation only. Do not overwrite the preserved completed result; new runs use new directories. The saved report adds final audio duration derived from WAV frames because its original `audioSeconds` field was the last five-second progress sample. New script runs use final duration directly.

Checked-in reports contain only synthetic/public benchmark text. Do not add student recordings, provider keys, giant models or private paths. End-user installation/downloads use the application model manager instead of these scripts.
