use crate::error::AppResult;

pub const TRANSLATION: &str = "hy-mt2-1.8b";
pub const STUDY: &str = "qwen3.5-4b";
pub const DIARIZATION: &str = "sortformer-4spk-v2";
/// CC BY 4.0 asks for attribution and a note of changes; saved beside the model.
pub const SORTFORMER_NOTICE: &str = "Sortformer speaker diarization model\n\
\"diar_streaming_sortformer_4spk-v2\" by NVIDIA, https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2 \
(revision 5240a64075176943f677d30fa2171c780229f341).\n\
Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/\n\
Changes: converted to GGUF and quantized to Q8_0 by the NeMo-Speech.cpp project.\n";
pub const TEXT_RUNTIME: &str = "llama.cpp b11366";

pub struct Model {
    pub id: &'static str,
    pub name: &'static str,
    pub repo: &'static str,
    pub file: &'static str,
    pub revision: &'static str,
    pub sha256: &'static str,
    pub size: u64,
    pub runtime: &'static str,
    pub license: &'static str,
}
pub fn get(id: &str) -> AppResult<Model> {
    use super::manager::*;
    Ok(match id {
        MODEL_ID => Model {
            id: MODEL_ID,
            name: "Nemotron Streaming EN 0.6B",
            repo: "nvidia/nemotron-speech-streaming-en-0.6b",
            file: MODEL_FILE,
            revision: REVISION,
            sha256: HASH,
            size: SIZE,
            runtime: "NeMo-Speech.cpp 0.1.0",
            license: "NVIDIA Open Model License",
        },
        TRANSLATION => Model {
            id: TRANSLATION,
            name: "Hy-MT2-1.8B · Q4_K_M",
            repo: "tencent/Hy-MT2-1.8B-GGUF",
            file: "Hy-MT2-1.8B-Q4_K_M.gguf",
            revision: "a0c709d9fac510f2c807aa3af52872340dc37a4a",
            sha256: "dc5f44fcf1fa496ee7ad725982c0c8c553a4de00259b53af84c4b89fb0c06699",
            size: 1133080448,
            runtime: TEXT_RUNTIME,
            license: "Apache 2.0 · Tencent GGUF",
        },
        STUDY => Model {
            id: STUDY,
            name: "Qwen3.5-4B · Q4_K_M",
            repo: "unsloth/Qwen3.5-4B-GGUF",
            file: "Qwen3.5-4B-Q4_K_M.gguf",
            revision: "e87f176479d0855a907a41277aca2f8ee7a09523",
            sha256: "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4",
            size: 2740937888,
            runtime: TEXT_RUNTIME,
            license: "Apache 2.0 · Unsloth GGUF of Qwen",
        },
        DIARIZATION => Model {
            id: DIARIZATION,
            name: "Sortformer 4spk v2 · Q8_0",
            repo: "nvidia/diar_streaming_sortformer_4spk-v2",
            file: "diar_streaming_sortformer_4spk-v2.q8_0.gguf",
            revision: "5240a64075176943f677d30fa2171c780229f341",
            sha256: "0679cfeb1ce356d0dea9470b31274f4bfc7eb927497d82005483770666da998a",
            size: 147075776,
            runtime: "NeMo-Speech.cpp 0.1.0",
            license: "CC BY 4.0 · NVIDIA",
        },
        _ => return Err(crate::error::ErrorCode::UnknownLocalModel.into()),
    })
}
