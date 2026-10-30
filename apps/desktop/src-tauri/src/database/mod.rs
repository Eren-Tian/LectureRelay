mod cleanup;
mod courses;
mod learning;
mod lectures;
pub(crate) mod live_summaries;
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
        let mut connection = Connection::open(path)
            .user_error(crate::error::ErrorCode::CannotOpenTheLocalDatabase)?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .user_error(crate::error::ErrorCode::CannotInitializeTheDatabase)?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
            )
            .user_error(crate::error::ErrorCode::CannotInitializeTheDatabase)?;
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .user_error(crate::error::ErrorCode::CannotReadDatabaseVersion)?;
        if version > 6 {
            return Err(
                crate::error::ErrorCode::ThisDatabaseRequiresANewerLecturerelayVersionUpgrade
                    .into(),
            );
        }
        if version == 0 {
            let tx = connection
                .transaction()
                .user_error(crate::error::ErrorCode::CannotStartDatabaseMigration)?;
            tx.execute_batch(include_str!("migrations/001_initial.sql"))
                .user_error(crate::error::ErrorCode::DatabaseMigrationFailed)?;
            tx.execute_batch("PRAGMA user_version=1;")
                .user_error(crate::error::ErrorCode::CannotSaveDatabaseVersion)?;
            tx.commit()
                .user_error(crate::error::ErrorCode::CannotCommitDatabaseMigration)?;
        }
        if version < 2 {
            let tx = connection
                .transaction()
                .user_error(crate::error::ErrorCode::CannotStartClassroomMigration)?;
            tx.execute_batch(include_str!("migrations/002_classroom.sql"))
                .user_error(crate::error::ErrorCode::ClassroomMigrationFailed)?;
            tx.execute_batch("PRAGMA user_version=2;")
                .user_error(crate::error::ErrorCode::CannotSaveDatabaseVersion)?;
            tx.commit()
                .user_error(crate::error::ErrorCode::CannotCommitClassroomMigration)?;
        }
        if version < 3 {
            let tx = connection
                .transaction()
                .user_error(crate::error::ErrorCode::CannotStartStudyWorkspaceMigration)?;
            tx.execute_batch(include_str!("migrations/003_study_workspace.sql"))
                .user_error(crate::error::ErrorCode::StudyWorkspaceMigrationFailed)?;
            tx.execute_batch("PRAGMA user_version=3;")
                .user_error(crate::error::ErrorCode::CannotSaveDatabaseVersion)?;
            tx.commit()
                .user_error(crate::error::ErrorCode::CannotCommitStudyWorkspaceMigration)?;
        }
        if version < 4 {
            connection
                .execute_batch("PRAGMA foreign_keys=OFF;")
                .user_error(crate::error::ErrorCode::CannotPrepareReliabilityMigration)?;
            let tx = connection
                .transaction()
                .user_error(crate::error::ErrorCode::CannotStartReliabilityMigration)?;
            tx.execute_batch(include_str!("migrations/004_reliability.sql"))
                .user_error(crate::error::ErrorCode::ReliabilityMigrationFailed)?;
            let errors: i64 = tx
                .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })
                .user_error(crate::error::ErrorCode::CannotVerifyMigration)?;
            if errors != 0 {
                return Err(crate::error::ErrorCode::ReliabilityMigrationFailedItsIntegrityCheckExistingDatabase.into());
            }
            tx.execute_batch("PRAGMA user_version=4;")
                .user_error(crate::error::ErrorCode::CannotSaveDatabaseVersion)?;
            tx.commit()
                .user_error(crate::error::ErrorCode::CannotCommitReliabilityMigration)?;
            connection
                .execute_batch("PRAGMA foreign_keys=ON;")
                .user_error(crate::error::ErrorCode::CannotEnableDatabaseIntegrityChecks)?;
        }
        // Explicit, idempotent metadata repair: the import task proves the source even
        // when an older decoder failed before saving audio_source. Ambiguous rows stay unchanged.
        connection.execute("UPDATE lectures SET audio_source='import' WHERE audio_source!='import' AND EXISTS(SELECT 1 FROM processing_tasks t WHERE t.lecture_id=lectures.id AND t.kind='import')", []).user_error(crate::error::ErrorCode::CannotRepairImportMetadata)?;
        connection.execute("UPDATE processing_tasks SET state='interrupted',message='App closed before processing finished. Saved results are preserved.' WHERE state='running'",[]).user_error(crate::error::ErrorCode::CannotRecoverProcessingTasks)?;
        if version < 5 {
            let tx = connection
                .transaction()
                .user_error(crate::error::ErrorCode::CannotStartLiveSummaryMigration)?;
            tx.execute_batch(include_str!("migrations/005_live_summaries.sql"))
                .user_error(crate::error::ErrorCode::LiveSummaryMigrationFailed)?;
            tx.execute_batch("PRAGMA user_version=5;")
                .user_error(crate::error::ErrorCode::CannotSaveDatabaseVersion)?;
            tx.commit()
                .user_error(crate::error::ErrorCode::CannotCommitLiveSummaryMigration)?;
        }
        if version < 6 {
            connection
                .execute_batch("PRAGMA foreign_keys=OFF;")
                .user_error(crate::error::ErrorCode::CannotPrepareLanguageMigration)?;
            let tx = connection
                .transaction()
                .user_error(crate::error::ErrorCode::CannotStartLanguageMigration)?;
            tx.execute_batch(include_str!("migrations/006_translation_languages.sql"))
                .user_error(crate::error::ErrorCode::LanguageMigrationFailed)?;
            let errors: i64 = tx
                .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })
                .user_error(crate::error::ErrorCode::CannotVerifyMigration)?;
            if errors != 0 {
                return Err(
                    crate::error::ErrorCode::LanguageMigrationFailedItsIntegrityCheck.into(),
                );
            }
            tx.execute_batch("PRAGMA user_version=6;")
                .user_error(crate::error::ErrorCode::CannotSaveDatabaseVersion)?;
            tx.commit()
                .user_error(crate::error::ErrorCode::CannotCommitLanguageMigration)?;
            connection
                .execute_batch("PRAGMA foreign_keys=ON;")
                .user_error(crate::error::ErrorCode::CannotEnableDatabaseIntegrityChecks)?;
        }
        connection.execute("UPDATE live_summary_cards SET state='deferred',message='The summary did not finish before the app closed. The source text is saved; you can retry it.' WHERE state='running'", []).user_error(crate::error::ErrorCode::CannotRecoverLiveSummaries)?;
        preferences::disable_local_live_summaries(&connection)?;
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
