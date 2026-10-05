mod cleanup;
mod courses;
mod learning;
mod lectures;
pub(crate) mod outline;
mod preferences;
pub(crate) mod review;
mod rows;
pub(crate) mod study;

use crate::error::{AppResult, UserFacing};
use rusqlite::Connection;
use std::sync::{Mutex, MutexGuard};

pub struct Storage {
    connection: Mutex<Connection>,
    pub(crate) snapshots: Mutex<()>,
}

impl Storage {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let mut connection =
            Connection::open(path).user_error("Cannot open the local database.")?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .user_error("Cannot initialize the database.")?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
            )
            .user_error("Cannot initialize the database.")?;
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .user_error("Cannot read database version.")?;
        if version > 4 {
            return Err(
                "This database requires a newer LectureRelay version. Upgrade the app.".into(),
            );
        }
        if version == 0 {
            let tx = connection
                .transaction()
                .user_error("Cannot start database migration.")?;
            tx.execute_batch(include_str!("migrations/001_initial.sql"))
                .user_error("Database migration failed.")?;
            tx.execute_batch("PRAGMA user_version=1;")
                .user_error("Cannot save database version.")?;
            tx.commit()
                .user_error("Cannot commit database migration.")?;
        }
        if version < 2 {
            let tx = connection
                .transaction()
                .user_error("Cannot start classroom migration.")?;
            tx.execute_batch(include_str!("migrations/002_classroom.sql"))
                .user_error("Classroom migration failed.")?;
            tx.execute_batch("PRAGMA user_version=2;")
                .user_error("Cannot save database version.")?;
            tx.commit()
                .user_error("Cannot commit classroom migration.")?;
        }
        if version < 3 {
            let tx = connection
                .transaction()
                .user_error("Cannot start study workspace migration.")?;
            tx.execute_batch(include_str!("migrations/003_study_workspace.sql"))
                .user_error("Study workspace migration failed.")?;
            tx.execute_batch("PRAGMA user_version=3;")
                .user_error("Cannot save database version.")?;
            tx.commit()
                .user_error("Cannot commit study workspace migration.")?;
        }
        if version < 4 {
            connection
                .execute_batch("PRAGMA foreign_keys=OFF;")
                .user_error("Cannot prepare reliability migration.")?;
            let tx = connection
                .transaction()
                .user_error("Cannot start reliability migration.")?;
            tx.execute_batch(include_str!("migrations/004_reliability.sql"))
                .user_error("Reliability migration failed.")?;
            let errors: i64 = tx
                .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })
                .user_error("Cannot verify migration.")?;
            if errors != 0 {
                return Err("Reliability migration failed its integrity check. Existing database was preserved.".into());
            }
            tx.execute_batch("PRAGMA user_version=4;")
                .user_error("Cannot save database version.")?;
            tx.commit()
                .user_error("Cannot commit reliability migration.")?;
            connection
                .execute_batch("PRAGMA foreign_keys=ON;")
                .user_error("Cannot enable database integrity checks.")?;
        }
        // Explicit, idempotent metadata repair: the import task proves the source even
        // when an older decoder failed before saving audio_source. Ambiguous rows stay unchanged.
        connection.execute("UPDATE lectures SET audio_source='import' WHERE audio_source!='import' AND EXISTS(SELECT 1 FROM processing_tasks t WHERE t.lecture_id=lectures.id AND t.kind='import')", []).user_error("Cannot repair import metadata.")?;
        connection.execute("UPDATE processing_tasks SET state='interrupted',message='App closed before processing finished. Saved results are preserved.' WHERE state='running'",[]).user_error("Cannot recover processing tasks.")?;
        Ok(Self {
            connection: Mutex::new(connection),
            snapshots: Mutex::new(()),
        })
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| "Database unavailable. Restart the app.".into())
    }
}
