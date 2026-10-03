use crate::{
    AppState,
    domain::now,
    error::{AppResult, UserFacing},
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::Write,
    path::PathBuf,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
};
use tauri::Emitter;

pub const MODEL_ID: &str = "nemotron-streaming";
pub const MODEL_FILE: &str = "nemotron-speech-streaming-en-0.6b.q8_0.gguf";
pub const REVISION: &str = "ebe59e5a817142986528bbbee5dba8db7b38ed50";
pub const HASH: &str = "d9a01898d2a611c8764e23a1c2f45e70bbd5a425dc4de93692ac951dd603812d";
pub const SIZE: u64 = 699872960;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub installed: bool,
    pub downloaded_bytes: u64,
    pub downloading: bool,
    pub revision: String,
    pub runtime_version: String,
    pub license: String,
    pub error: Option<String>,
}
#[derive(Default)]
pub struct ModelManager {
    pub active: Mutex<Option<ModelStatus>>,
    pub cancel: AtomicBool,
}
pub fn path(state: &AppState) -> PathBuf {
    state.paths.data.join("models").join(MODEL_FILE)
}
pub fn status(state: &AppState) -> AppResult<ModelStatus> {
    if let Some(value) = state
        .models
        .active
        .lock()
        .user_error("Model manager unavailable.")?
        .clone()
    {
        return Ok(value);
    }
    let installed = path(state).metadata().is_ok_and(|m| m.len() == SIZE)
        && state
            .paths
            .data
            .join("models/nemotron-streaming.json")
            .is_file()
        && std::fs::read(state.paths.data.join("models/nemotron-streaming.json"))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .is_some_and(|m| {
                m["id"] == MODEL_ID
                    && m["revision"] == REVISION
                    && m["sha256"] == HASH
                    && m["runtimeVersion"] == "NeMo-Speech.cpp 0.1.0"
            });
    Ok(ModelStatus {
        id: MODEL_ID.into(),
        name: "Recommended · Nemotron Streaming".into(),
        size_bytes: SIZE,
        installed,
        downloaded_bytes: if installed { SIZE } else { 0 },
        downloading: false,
        revision: REVISION.into(),
        runtime_version: "NeMo-Speech.cpp 0.1.0 · CPU".into(),
        license: "NVIDIA Open Model License".into(),
        error: None,
    })
}
pub async fn download<R: tauri::Runtime>(
    state: &AppState,
    app: &tauri::AppHandle<R>,
) -> AppResult<()> {
    download_with(state, |value| {
        let _ = app.emit("model-status", value);
    })
    .await
}

pub(crate) async fn download_with(
    state: &AppState,
    on_status: impl Fn(&ModelStatus),
) -> AppResult<()> {
    let mut value = {
        let _gate = state.gate.lock().user_error("The app is busy.")?;
        if state.recorder.status()?.is_some()
            || state.live.active()
            || state.jobs.status()?.is_some()
        {
            return Err("Download models after the lecture and current task finish.".into());
        }
        let value = status(state)?;
        if value.installed {
            return Ok(());
        }
        if value.downloading {
            return Err("This model is already downloading.".into());
        }
        state.models.cancel.store(false, Ordering::Relaxed);
        let mut value = value;
        value.downloading = true;
        *state
            .models
            .active
            .lock()
            .user_error("Model manager unavailable.")? = Some(value.clone());
        value
    };
    let part = path(state).with_extension("part");
    let _ = rustls::crypto::ring::default_provider().install_default();
    let result = async {
        let client = reqwest::Client::builder()
            .use_rustls_tls()
            .connect_timeout(std::time::Duration::from_secs(15))
            .timeout(std::time::Duration::from_secs(1800))
            .build()
            .user_error("Cannot initialize model download.")?;
        let url = format!("https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b/resolve/{REVISION}/{MODEL_FILE}");
        let mut response = cancellable(&state.models.cancel, client.get(url).send(),
            "Cannot download model. Check your connection.").await?
            .error_for_status().user_error("Model download unavailable.")?;
        let mut file = File::create(&part)
            .user_error("Cannot create model file. Check disk space.")?;
        let mut hash = Sha256::new();
        let mut last = std::time::Instant::now();
        while let Some(chunk) = cancellable(&state.models.cancel, response.chunk(),
            "Model download interrupted. Try again.").await? {
            value.downloaded_bytes += chunk.len() as u64;
            if value.downloaded_bytes > SIZE {
                return Err("Model exceeds the expected size.".into());
            }
            file.write_all(&chunk).user_error("Cannot write model. Check disk space.")?;
            hash.update(&chunk);
            if last.elapsed().as_millis() > 250 {
                *state.models.active.lock().user_error("Model manager unavailable.")? = Some(value.clone());
                on_status(&value);
                last = std::time::Instant::now();
            }
        }
        if state.models.cancel.load(Ordering::Relaxed) {
            return Err("Model download cancelled.".into());
        }
        if value.downloaded_bytes != SIZE || format!("{:x}", hash.finalize()) != HASH {
            return Err("Model integrity check failed. Download again.".into());
        }
        file.sync_all().user_error("Cannot save model.")?;
        drop(file);
        std::fs::rename(&part, path(state)).user_error("Cannot install model.")?;
        let manifest = serde_json::json!({"id":MODEL_ID,"revision":REVISION,"sha256":HASH,"size":SIZE,"runtimeVersion":"NeMo-Speech.cpp 0.1.0","installedAt":now()});
        for (source, target) in [
            ("licenses/NVIDIA-Open-Model-License.pdf", "NVIDIA-Open-Model-License.pdf"),
            ("licenses/NVIDIA-Model-NOTICE.txt", "NOTICE.txt"),
        ] {
            std::fs::copy(state.runtime.join(source), state.paths.data.join("models").join(target))
                .user_error("Cannot save model license. Reinstall LectureRelay.")?;
        }
        state.storage.install_model(MODEL_ID, REVISION, HASH, SIZE)?;
        // The manifest marks a complete installation, including its required license.
        crate::storage::write_atomic(&state.paths.data.join("models/nemotron-streaming.json"), manifest.to_string().as_bytes())?;
        Ok(())
    }.await;
    if result.is_err() {
        let _ = std::fs::remove_file(part);
    }
    *state
        .models
        .active
        .lock()
        .user_error("Model manager unavailable.")? = None;
    let mut final_status = status(state)?;
    final_status.error = result.as_ref().err().cloned();
    on_status(&final_status);
    result
}
pub fn remove(state: &AppState) -> AppResult<()> {
    let _gate = state.gate.lock().user_error("The app is busy.")?;
    if state.recorder.status()?.is_some()
        || state.live.active()
        || state.jobs.status()?.is_some()
        || status(state)?.downloading
    {
        return Err("Remove models after active work finishes.".into());
    }
    for p in [
        path(state),
        state.paths.data.join("models/nemotron-streaming.json"),
    ] {
        if p.exists() {
            std::fs::remove_file(p).user_error("Cannot remove model.")?;
        }
    }
    state.storage.remove_model(MODEL_ID)
}

async fn cancellable<T, E>(
    cancel: &AtomicBool,
    future: impl std::future::Future<Output = Result<T, E>>,
    message: &str,
) -> AppResult<T> {
    // Keep the same pending network future: timeout polling must not reconnect
    // or discard a partially read response while checking cancellation.
    let mut pending = std::pin::pin!(future);
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Model download cancelled.".into());
        }
        if let Ok(result) =
            tokio::time::timeout(std::time::Duration::from_millis(250), pending.as_mut()).await
        {
            return result.user_error(message);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_interrupts_stalled_network_without_waiting_for_request_timeout() {
        let cancel = std::sync::Arc::new(AtomicBool::new(false));
        let signal = cancel.clone();
        let thread = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(20));
            signal.store(true, Ordering::Relaxed);
        });
        let start = std::time::Instant::now();
        let result = tauri::async_runtime::block_on(cancellable(
            &cancel,
            std::future::pending::<Result<(), ()>>(),
            "Network error.",
        ));
        thread.join().unwrap();
        assert_eq!(result.unwrap_err(), "Model download cancelled.");
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
    }
}
