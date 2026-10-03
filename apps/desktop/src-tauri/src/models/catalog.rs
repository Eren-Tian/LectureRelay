use crate::error::AppResult;

pub const TRANSLATION: &str = "hy-mt2-1.8b";
pub const STUDY: &str = "qwen3.5-4b";
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
        _ => return Err("Unknown local model.".into()),
    })
}
