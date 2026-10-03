use super::AppPaths;
use crate::error::{AppResult, UserFacing};
use std::{os::windows::fs::MetadataExt, path::Path};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsage {
    library_bytes: u64,
    model_bytes: u64,
}

impl AppPaths {
    pub fn usage(&self) -> AppResult<StorageUsage> {
        Ok(StorageUsage {
            library_bytes: folder_bytes(&self.library)?,
            model_bytes: folder_bytes(&self.data.join("models"))?,
        })
    }
}

fn folder_bytes(path: &Path) -> AppResult<u64> {
    let mut bytes = 0u64;
    let mut pending = vec![path.to_path_buf()];
    while let Some(path) = pending.pop() {
        let metadata = std::fs::symlink_metadata(&path)
            .user_error("Storage usage is unavailable. Check folder permissions.")?;
        // Skip junctions and links, including a redirected root, instead of
        // following a cycle or measuring content outside the library.
        if metadata.file_attributes() & 0x400 != 0 {
            continue;
        }
        if metadata.is_file() {
            bytes = bytes.saturating_add(metadata.len());
        } else if metadata.is_dir() {
            for entry in std::fs::read_dir(&path)
                .user_error("Storage usage is unavailable. Check folder permissions.")?
            {
                pending.push(entry.user_error("Storage usage is unavailable.")?.path());
            }
        }
    }
    Ok(bytes)
}
