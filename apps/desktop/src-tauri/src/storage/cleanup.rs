//! Rename before deleting database rows; a durable journal resolves interrupted operations.
//! All paths are derived from app roots and UUIDs, never from database recording paths.
use super::{AppPaths, write_atomic};
use crate::{
    database::Storage,
    domain::new_id,
    error::{AppResult, UserFacing},
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    os::windows::fs::MetadataExt,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize)]
struct Entry {
    library: bool,
    relative: PathBuf,
    staged: String,
}
#[derive(Serialize, Deserialize)]
struct Journal {
    id: String,
    entries: Vec<Entry>,
}

fn safe(root: &Path, relative: &Path) -> AppResult<PathBuf> {
    if relative
        .components()
        .any(|p| !matches!(p, std::path::Component::Normal(_)))
        || relative.as_os_str().is_empty()
    {
        return Err("Invalid cleanup path. Nothing was deleted.".into());
    }
    // Refuse reparse points at every level, including redirected roots.
    let mut path = root.to_path_buf();
    check_tree_root(&path)?;
    for component in relative.components() {
        path.push(component);
        check_tree_root(&path)?;
    }
    Ok(path)
}
fn check_tree_root(path: &Path) -> AppResult<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_attributes() & 0x400 != 0 => Err("Storage contains a link or junction. Cleanup was stopped to protect files outside LectureRelay.".into()),
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Cannot inspect storage for cleanup. Check permissions.".into()),
    }
}
fn inspect_tree(path: &Path) -> AppResult<()> {
    check_tree_root(path)?;
    if path.is_dir() {
        for entry in fs::read_dir(path).user_error("Cannot inspect storage.")? {
            inspect_tree(&entry.user_error("Cannot inspect storage.")?.path())?;
        }
    }
    Ok(())
}
fn pair(paths: &AppPaths, entry: &Entry) -> AppResult<(PathBuf, PathBuf)> {
    let names: Vec<_> = entry.relative.iter().map(|p| p.to_string_lossy()).collect();
    let allowed = if entry.library {
        matches!(
            names.first().map(|v| v.as_ref()),
            Some("Courses" | "Exports")
        ) && (names.len() <= 2
            || (names.len() == 3
                && names[0] == "Courses"
                && uuid::Uuid::parse_str(&names[1]).is_ok()
                && uuid::Uuid::parse_str(&names[2]).is_ok()))
    } else {
        matches!(
            names.first().map(|v| v.as_ref()),
            Some("models" | "cache" | "temp" | "logs" | "recovery")
        ) && names.len() <= 2
    };
    if !allowed {
        return Err("Invalid cleanup scope. Files were preserved.".into());
    }
    let root = if entry.library {
        &paths.library
    } else {
        &paths.data
    };
    Ok((
        safe(root, &entry.relative)?,
        safe(root, Path::new(&entry.staged))?,
    ))
}
fn settle(paths: &AppPaths, db: &Storage, journal: &Journal) -> AppResult<()> {
    let committed = db.cleanup_committed(&journal.id)?;
    for entry in journal.entries.iter().rev() {
        let (original, staged) = pair(paths, entry)?;
        if !staged.exists() {
            continue;
        }
        if committed {
            inspect_tree(&staged)?;
            if staged.is_dir() { fs::remove_dir_all(&staged) } else { fs::remove_file(&staged) }
                .user_error("Content was deleted, but some files could not be freed. Restart LectureRelay to retry cleanup.")?;
        } else {
            // Startup may have created an empty root before recovery. Never remove nonempty data.
            if original.is_dir()
                && fs::read_dir(&original)
                    .user_error("Cannot inspect cleanup recovery.")?
                    .next()
                    .is_none()
            {
                fs::remove_dir(&original).user_error("Cannot restore interrupted cleanup.")?;
            }
            if original.exists() {
                return Err("Cleanup recovery found conflicting files. Keep both folders and restart after resolving the conflict.".into());
            }
            fs::rename(&staged, &original)
                .user_error("Cannot restore files after interrupted cleanup.")?;
        }
    }
    fs::remove_file(
        paths
            .data
            .join("state")
            .join(format!("cleanup-{}.json", journal.id)),
    )
    .user_error("Cannot finish cleanup recovery.")?;
    db.forget_cleanup(&journal.id)
}

pub fn recover(paths: &AppPaths, db: &Storage) -> AppResult<()> {
    let dir = safe(&paths.data, Path::new("state"))?;
    for entry in fs::read_dir(dir).user_error("Cannot inspect cleanup recovery.")? {
        let entry = entry.user_error("Cannot inspect cleanup recovery.")?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with("cleanup-") || !name.ends_with(".json") {
            continue;
        }
        check_tree_root(&entry.path())?;
        let journal: Journal = serde_json::from_slice(
            &fs::read(entry.path()).user_error("Cannot read cleanup journal.")?,
        )
        .user_error("Invalid cleanup journal.")?;
        uuid::Uuid::parse_str(&journal.id).map_err(|_| "Invalid cleanup journal.")?;
        if name != format!("cleanup-{}.json", journal.id) {
            return Err("Invalid cleanup journal name.".into());
        }
        // An interrupted journal may only refer to our staged files.
        for (i, item) in journal.entries.iter().enumerate() {
            if item.staged != format!(".cleanup-{}-{i}", journal.id) {
                return Err("Invalid cleanup destination.".into());
            }
        }
        settle(paths, db, &journal)?;
    }
    Ok(())
}

pub fn run(paths: &AppPaths, db: &Storage, course: Option<&str>) -> AppResult<Vec<String>> {
    recover(paths, db)?;
    let ids: Vec<String> = if let Some(id) = course {
        uuid::Uuid::parse_str(id).map_err(|_| "Invalid course.")?;
        if !db.trash()?.iter().any(|c| c.id == id) {
            return Err("Move this course to Trash before deleting it permanently.".into());
        }
        db.lectures(id)?.into_iter().map(|l| l.id).collect()
    } else {
        db.courses()?
            .into_iter()
            .chain(db.trash()?)
            .map(|c| db.lectures(&c.id))
            .collect::<AppResult<Vec<_>>>()?
            .into_iter()
            .flatten()
            .map(|l| l.id)
            .collect()
    };
    let mut targets: Vec<(bool, PathBuf)> = if let Some(id) = course {
        vec![(true, Path::new("Courses").join(id))]
    } else {
        vec![
            (true, "Courses".into()),
            (true, "Exports".into()),
            (false, "models".into()),
            (false, "cache".into()),
            (false, "temp".into()),
            (false, "logs".into()),
            (false, "recovery".into()),
        ]
    };
    if course.is_some() {
        targets.extend(lecture_extras(paths, &ids)?);
    }
    execute(paths, db, targets, |operation| {
        db.purge_content(operation, course)
    })?;
    Ok(ids)
}

pub fn delete_lecture(paths: &AppPaths, db: &Storage, id: &str) -> AppResult<()> {
    recover(paths, db)?;
    uuid::Uuid::parse_str(id).map_err(|_| "Invalid lecture.")?;
    let lecture = db.lecture(id)?;
    // Validate both identifiers before deriving any deletion path.
    paths.lecture_dir(&lecture.course_id, id)?;
    if lecture.status == crate::domain::LectureStatus::Recording {
        return Err("Stop and save this lecture before deleting it.".into());
    }
    let mut targets = vec![(true, Path::new("Courses").join(&lecture.course_id).join(id))];
    targets.extend(lecture_extras(paths, &[id.to_owned()])?);
    execute(paths, db, targets, |operation| {
        db.purge_lecture_content(operation, id)
    })
}

fn lecture_extras(paths: &AppPaths, ids: &[String]) -> AppResult<Vec<(bool, PathBuf)>> {
    let mut targets = Vec::new();
    for (library, folder) in [(true, "Exports"), (false, "logs"), (false, "recovery")] {
        let root = if library { &paths.library } else { &paths.data };
        for entry in fs::read_dir(safe(root, Path::new(folder))?)
            .user_error("Cannot inspect course files.")?
        {
            let entry = entry.user_error("Cannot inspect course files.")?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if ids
                .iter()
                .any(|id| name.starts_with(&format!("{id}-")) || name == format!("{id}.json"))
            {
                targets.push((library, Path::new(folder).join(name)));
            }
        }
    }
    Ok(targets)
}

fn execute(
    paths: &AppPaths,
    db: &Storage,
    targets: Vec<(bool, PathBuf)>,
    commit: impl FnOnce(&str) -> AppResult<()>,
) -> AppResult<()> {
    let operation = new_id();
    let mut journal = Journal {
        id: operation,
        entries: Vec::new(),
    };
    for (library, relative) in targets {
        let root = if library { &paths.library } else { &paths.data };
        let path = safe(root, &relative)?;
        if !path.exists() {
            continue;
        }
        inspect_tree(&path)?;
        journal.entries.push(Entry {
            library,
            relative,
            staged: format!(".cleanup-{}-{}", journal.id, journal.entries.len()),
        });
    }
    let journal_path = safe(
        &paths.data,
        &Path::new("state").join(format!("cleanup-{}.json", journal.id)),
    )?;
    write_atomic(
        &journal_path,
        &serde_json::to_vec(&journal).user_error("Cannot prepare cleanup journal.")?,
    )?;
    let result = (|| {
        for entry in &journal.entries {
            let (original, staged) = pair(paths, entry)?;
            if staged.exists() {
                return Err("Cleanup destination already exists.".into());
            }
            fs::rename(original, staged).user_error(
                "Cannot free storage while files are in use. Close external players and try again.",
            )?;
        }
        commit(&journal.id)
    })();
    let settled = settle(paths, db, &journal);
    AppPaths::initialize(paths.data.clone(), paths.library.clone())?;
    settled?;
    result?;
    db.compact()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn locked_file_rolls_back_staging_without_losing_other_files() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/test-fixtures")
            .join(new_id());
        let paths = AppPaths::initialize(root.join("data"), root.join("library")).unwrap();
        let db = Storage::open(&paths.data.join("app.db")).unwrap();
        let model = paths.data.join("models/locked.gguf");
        fs::write(&model, b"preserve model").unwrap();
        fs::write(paths.library.join("Exports/keep.txt"), b"preserve export").unwrap();
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&model)
            .unwrap();
        assert!(run(&paths, &db, None).is_err());
        assert!(paths.library.join("Exports/keep.txt").exists());
        drop(lock);
        recover(&paths, &db).unwrap();
        assert_eq!(fs::read(model).unwrap(), b"preserve model");
        assert!(fs::read_dir(paths.data.join("state")).unwrap().all(|e| {
            !e.unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("cleanup-")
        }));
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn crash_journal_restores_uncommitted_files_and_finishes_committed_cleanup() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/test-fixtures")
            .join(new_id());
        let paths = AppPaths::initialize(root.join("data"), root.join("library")).unwrap();
        let db = Storage::open(&paths.data.join("app.db")).unwrap();
        for committed in [false, true] {
            let id = new_id();
            let staged = format!(".cleanup-{id}-0");
            fs::write(paths.data.join("models/fixture.gguf"), b"fixture").unwrap();
            let journal = Journal {
                id,
                entries: vec![Entry {
                    library: false,
                    relative: "models".into(),
                    staged: staged.clone(),
                }],
            };
            write_atomic(
                &paths
                    .data
                    .join("state")
                    .join(format!("cleanup-{}.json", journal.id)),
                &serde_json::to_vec(&journal).unwrap(),
            )
            .unwrap();
            fs::rename(paths.data.join("models"), paths.data.join(&staged)).unwrap();
            if committed {
                db.purge_content(&journal.id, None).unwrap();
            }
            AppPaths::initialize(paths.data.clone(), paths.library.clone()).unwrap();
            recover(&paths, &db).unwrap();
            assert!(!paths.data.join(&staged).exists());
            assert_eq!(paths.data.join("models/fixture.gguf").exists(), !committed);
            assert!(!db.cleanup_committed(&journal.id).unwrap());
        }
        assert!(safe(&paths.data, Path::new("../outside")).is_err());
        let invalid = Entry {
            library: false,
            relative: "app.db".into(),
            staged: format!(".cleanup-{}-0", new_id()),
        };
        assert!(pair(&paths, &invalid).is_err());
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }
}
