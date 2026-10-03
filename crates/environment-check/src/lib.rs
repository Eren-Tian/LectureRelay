//! Toolchain smoke check only; this is not the application storage layer.

pub fn check_sqlite() -> rusqlite::Result<String> {
    let connection = rusqlite::Connection::open_in_memory()?;
    connection.query_row("SELECT sqlite_version()", [], |row| row.get(0))
}

#[cfg(test)]
mod tests {
    #[test]
    fn bundled_sqlite_supports_transactions_and_assistance_languages() {
        let mut connection = rusqlite::Connection::open_in_memory().unwrap();
        connection
            .execute_batch("CREATE TABLE smoke (text TEXT NOT NULL);")
            .unwrap();
        let transaction = connection.transaction().unwrap();
        let sample = "English · 中文 · 日本語 · 한국어";
        transaction
            .execute("INSERT INTO smoke (text) VALUES (?1)", [sample])
            .unwrap();
        transaction.commit().unwrap();
        let actual: String = connection
            .query_row("SELECT text FROM smoke", [], |row| row.get(0))
            .unwrap();
        assert_eq!(actual, sample);
        assert!(!super::check_sqlite().unwrap().is_empty());
    }
}
