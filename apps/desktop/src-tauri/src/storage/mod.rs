pub(crate) mod cleanup;
mod recovery;
mod snapshots;
pub(crate) mod usage;

use crate::domain::{Lecture, Note, TranscriptSegment};
use crate::error::{AppResult, UserFacing};
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct AppPaths {
    pub data: PathBuf,
    pub library: PathBuf,
    /// The MSIX package this process runs inside, such as another app that
    /// started LectureRelay. Windows then stores files LectureRelay creates
    /// under AppData in that package's private folder, where a normally started
    /// LectureRelay cannot see them. `None` for ordinary starts and test roots.
    pub host_package: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub database: String,
    pub library: String,
    pub exports: String,
    pub state: String,
    pub version: &'static str,
}

/// Full name of the MSIX package this process runs inside, if any. An ordinary
/// start has no package identity; a process launched from a packaged app such
/// as Codex inherits that app's identity and its AppData redirection.
pub(crate) fn host_package() -> Option<String> {
    use windows::{
        Win32::{
            Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS},
            Storage::Packaging::Appx::GetCurrentPackageFullName,
        },
        core::PWSTR,
    };
    let mut length = 0u32;
    // SAFETY: No buffer and a zero length only query the required length;
    // `length` is a live out-parameter.
    if unsafe { GetCurrentPackageFullName(&mut length, None) } != ERROR_INSUFFICIENT_BUFFER {
        return None; // APPMODEL_ERROR_NO_PACKAGE: not packaged.
    }
    let mut name = vec![0u16; length as usize];
    // SAFETY: `name` holds exactly `length` UTF-16 units, the capacity passed.
    let result = unsafe { GetCurrentPackageFullName(&mut length, Some(PWSTR(name.as_mut_ptr()))) };
    let end = name.iter().position(|&c| c == 0).unwrap_or(name.len());
    // A package identity exists even if the name could not be read.
    Some(if result == ERROR_SUCCESS {
        String::from_utf16_lossy(&name[..end])
    } else {
        String::new()
    })
}

impl AppPaths {
    pub fn production() -> AppResult<Self> {
        // Debug-only isolation for native UI verification; release builds always
        // use Windows Known Folders and never honor this environment variable.
        #[cfg(debug_assertions)]
        if let Some(root) = std::env::var_os("LECTURERELAY_TEST_ROOT") {
            let root = PathBuf::from(root);
            if !root.is_absolute() {
                return Err(crate::error::ErrorCode::TheTestDataFolderMustBeAnAbsolute.into());
            }
            return Self::initialize(root.join("app-data"), root.join("library"));
        }
        let data = dirs::data_local_dir()
            .ok_or(crate::error::ErrorCode::CannotLocateTheWindowsAppDataFolder)?;
        let documents = dirs::document_dir()
            .ok_or(crate::error::ErrorCode::CannotLocateTheWindowsDocumentsFolder)?;
        let mut paths =
            Self::initialize(data.join("LectureRelay"), documents.join("LectureRelay"))?;
        paths.host_package = host_package();
        Ok(paths)
    }

    pub fn initialize(data: PathBuf, library: PathBuf) -> AppResult<Self> {
        let paths = Self {
            data,
            library,
            host_package: None,
        };
        for dir in ["cache", "models", "logs", "temp", "recovery", "state"] {
            std::fs::create_dir_all(paths.data.join(dir)).user_error(
                crate::error::ErrorCode::CannotCreateTheAppDataFolderCheckPermissions,
            )?;
        }
        for dir in ["Courses", "Exports"] {
            std::fs::create_dir_all(paths.library.join(dir)).user_error(
                crate::error::ErrorCode::CannotCreateTheLibraryFolderCheckDocumentsPermissions,
            )?;
        }
        Ok(paths)
    }

    pub fn lecture_dir(&self, course_id: &str, lecture_id: &str) -> AppResult<PathBuf> {
        for id in [course_id, lecture_id] {
            uuid::Uuid::parse_str(id)
                .user_error(crate::error::ErrorCode::InvalidCourseOrLectureIdentifier)?;
        }
        Ok(self
            .library
            .join("Courses")
            .join(course_id)
            .join(lecture_id))
    }

    pub fn acquire_instance_lock(&self) -> AppResult<std::fs::File> {
        use std::os::windows::fs::OpenOptionsExt;
        // Windows sharing mode 0 keeps this data root exclusive until the File
        // is dropped. After a crash the OS releases it without stale PID logic.
        std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .share_mode(0)
            .open(self.data.join("state").join("instance.lock"))
            .user_error(crate::error::ErrorCode::LecturerelayIsAlreadyRunningOrTheAppData)
    }

    pub fn recording(&self, course_id: &str, lecture_id: &str) -> AppResult<PathBuf> {
        Ok(self
            .lecture_dir(course_id, lecture_id)?
            .join("recording.wav"))
    }

    pub fn info(&self) -> StorageInfo {
        StorageInfo {
            database: self.data.join("app.db").to_string_lossy().into(),
            library: self.library.to_string_lossy().into(),
            exports: self.library.join("Exports").to_string_lossy().into(),
            state: self.data.to_string_lossy().into(),
            version: env!("CARGO_PKG_VERSION"),
        }
    }

    pub fn snapshot(
        &self,
        lecture: &Lecture,
        segments: &[TranscriptSegment],
        note: Option<&Note>,
    ) -> AppResult<()> {
        let dir = self.lecture_dir(&lecture.course_id, &lecture.id)?;
        std::fs::create_dir_all(&dir)
            .user_error(crate::error::ErrorCode::CannotCreateTheLectureFolder)?;
        write_atomic(
            &dir.join("metadata.json"),
            &serde_json::to_vec_pretty(lecture)
                .user_error(crate::error::ErrorCode::CannotEncodeLectureMetadata)?,
        )?;
        write_atomic(
            &dir.join("transcript.json"),
            &serde_json::to_vec_pretty(segments)
                .user_error(crate::error::ErrorCode::CannotEncodeTranscript)?,
        )?;
        if let Some(note) = note {
            write_atomic(&dir.join("notes.md"), note.body.as_bytes())?;
        }
        Ok(())
    }
}

pub fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    use std::io::Write;
    // A fixed .pending name lets concurrent snapshots/exports overwrite each
    // other's bytes, including different destinations with the same stem.
    let name = path
        .file_name()
        .ok_or(crate::error::ErrorCode::InvalidLocalFilePath)?;
    let temporary = path.with_file_name(format!(
        ".{}.{}.pending",
        name.to_string_lossy(),
        uuid::Uuid::new_v4()
    ));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .user_error(crate::error::ErrorCode::CannotWriteALocalFileCheckDiskSpace)?;
    struct Temporary(PathBuf);
    impl Drop for Temporary {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    let cleanup = Temporary(temporary);
    let result: AppResult<()> = (|| {
        file.write_all(bytes)
            .user_error(crate::error::ErrorCode::CannotWriteTheFileCheckAvailableDiskSpace)?;
        file.sync_all()
            .user_error(crate::error::ErrorCode::CannotSaveFile)?;
        Ok(())
    })();
    drop(file); // Close before cleanup on Windows, including a failed write/sync.
    result?;
    // Windows rename replaces an existing file through MoveFileEx semantics.
    std::fs::rename(&cleanup.0, path)
        .user_error(crate::error::ErrorCode::CannotUpdateTheFileCheckWhetherAnotherApp)
}
