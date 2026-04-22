use rusqlite::Connection;

use crate::{db::schema::MIGRATIONS, error::AppError};

pub fn run_migrations(conn: &mut Connection) -> Result<(), AppError> {
    let current: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(AppError::from)?;
    let target = MIGRATIONS.len() as i64;
    if current >= target {
        return Ok(());
    }

    let tx = conn.transaction().map_err(AppError::from)?;
    for migration in &MIGRATIONS[current as usize..] {
        tx.execute_batch(migration).map_err(AppError::from)?;
    }
    tx.execute_batch(&format!("PRAGMA user_version = {target}"))
        .map_err(AppError::from)?;
    tx.commit().map_err(AppError::from)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    fn open_memory() -> Connection {
        Connection::open_in_memory().expect("in-memory db must open")
    }

    #[test]
    fn fresh_db_gets_migrated_to_latest() {
        let mut conn = open_memory();
        run_migrations(&mut conn).expect("migration must succeed");
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .expect("must query user_version");
        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    fn migration_is_idempotent() {
        let mut conn = open_memory();
        run_migrations(&mut conn).expect("first migration must succeed");
        run_migrations(&mut conn).expect("second migration must succeed");
    }

    #[test]
    fn schema_v1_creates_required_tables() {
        let mut conn = open_memory();
        run_migrations(&mut conn).expect("migration must succeed");
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .expect("must prepare query")
            .query_map([], |r| r.get(0))
            .expect("query must work")
            .map(|r| r.expect("row mapping must work"))
            .collect();
        assert!(tables.contains(&"meta".to_string()));
        assert!(tables.contains(&"groups".to_string()));
        assert!(tables.contains(&"accounts".to_string()));
    }
}
