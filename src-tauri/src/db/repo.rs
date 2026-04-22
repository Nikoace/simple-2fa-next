use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub group_id: Option<i64>,
    pub name: String,
    pub issuer: Option<String>,
    pub algorithm: String,
    pub digits: u8,
    pub period: u32,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// The secret is never included in Account — only the encrypted blob is stored.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccount {
    pub name: String,
    pub issuer: Option<String>,
    pub secret_cipher: Vec<u8>,
    pub algorithm: Option<String>,
    pub digits: Option<u8>,
    pub period: Option<u32>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub group_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub issuer: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub group_id: Option<i64>,
    pub notes: Option<String>,
}

pub struct AccountRepo<'a>(pub &'a Connection);

impl<'a> AccountRepo<'a> {
    pub fn get(&self, id: i64) -> Result<Account, AppError> {
        self.0
            .query_row(
                "SELECT id, group_id, name, issuer, algorithm, digits, period,
                         icon, color, notes, sort_order, created_at, updated_at
                  FROM accounts WHERE id = ?1",
                params![id],
                |r| {
                    Ok(Account {
                        id: r.get(0)?,
                        group_id: r.get(1)?,
                        name: r.get(2)?,
                        issuer: r.get(3)?,
                        algorithm: r.get(4)?,
                        digits: r.get::<_, u8>(5)?,
                        period: r.get::<_, u32>(6)?,
                        icon: r.get(7)?,
                        color: r.get(8)?,
                        notes: r.get(9)?,
                        sort_order: r.get(10)?,
                        created_at: r.get(11)?,
                        updated_at: r.get(12)?,
                    })
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound,
                other => AppError::from(other),
            })
    }

    /// Fetches all accounts together with their encrypted secret blobs in one query.
    pub fn list_with_cipher(&self) -> Result<Vec<(Account, Vec<u8>)>, AppError> {
        let mut stmt = self.0.prepare(
            "SELECT id, group_id, name, issuer, algorithm, digits, period,
                    icon, color, notes, sort_order, created_at, updated_at, secret_cipher
             FROM accounts ORDER BY sort_order ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                Account {
                    id: r.get(0)?,
                    group_id: r.get(1)?,
                    name: r.get(2)?,
                    issuer: r.get(3)?,
                    algorithm: r.get(4)?,
                    digits: r.get::<_, u8>(5)?,
                    period: r.get::<_, u32>(6)?,
                    icon: r.get(7)?,
                    color: r.get(8)?,
                    notes: r.get(9)?,
                    sort_order: r.get(10)?,
                    created_at: r.get(11)?,
                    updated_at: r.get(12)?,
                },
                r.get::<_, Vec<u8>>(13)?,
            ))
        })?;
        rows.map(|r| r.map_err(AppError::from)).collect()
    }

    pub fn get_secret_cipher(&self, id: i64) -> Result<Vec<u8>, AppError> {
        self.0
            .query_row(
                "SELECT secret_cipher FROM accounts WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound,
                other => AppError::from(other),
            })
    }

    pub fn create(&self, inp: CreateAccount) -> Result<Account, AppError> {
        let now = now_ms();
        let sort_order: i64 = self
            .0
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM accounts",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        self.0.execute(
            "INSERT INTO accounts
             (group_id, name, issuer, secret_cipher, algorithm, digits, period,
              icon, color, notes, sort_order, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)",
            params![
                inp.group_id,
                inp.name,
                inp.issuer,
                inp.secret_cipher,
                inp.algorithm.as_deref().unwrap_or("SHA1"),
                inp.digits.unwrap_or(6),
                inp.period.unwrap_or(30),
                inp.icon,
                inp.color,
                None::<String>,
                sort_order,
                now,
            ],
        )?;
        let id = self.0.last_insert_rowid();
        self.get(id)
    }

    pub fn update(&self, id: i64, upd: UpdateAccount) -> Result<Account, AppError> {
        let now = now_ms();
        self.0.execute(
            "UPDATE accounts SET
                name       = COALESCE(?2, name),
                issuer     = CASE WHEN ?3 IS NOT NULL THEN ?3 ELSE issuer END,
                icon       = CASE WHEN ?4 IS NOT NULL THEN ?4 ELSE icon END,
                color      = CASE WHEN ?5 IS NOT NULL THEN ?5 ELSE color END,
                group_id   = CASE WHEN ?6 IS NOT NULL THEN ?6 ELSE group_id END,
                notes      = CASE WHEN ?7 IS NOT NULL THEN ?7 ELSE notes END,
                updated_at = ?8
             WHERE id = ?1",
            params![
                id, upd.name, upd.issuer, upd.icon, upd.color, upd.group_id, upd.notes, now
            ],
        )?;
        self.get(id)
    }

    pub fn delete(&self, id: i64) -> Result<(), AppError> {
        let n = self
            .0
            .execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        if n == 0 {
            Err(AppError::NotFound)
        } else {
            Ok(())
        }
    }

    pub fn reorder(&self, ids: &[i64]) -> Result<(), AppError> {
        for (i, id) in ids.iter().enumerate() {
            self.0.execute(
                "UPDATE accounts SET sort_order = ?1 WHERE id = ?2",
                params![i as i64, id],
            )?;
        }
        Ok(())
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;
    use crate::db::migrate::run_migrations;

    fn make_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("in-memory db must open");
        run_migrations(&mut conn).expect("migrations must succeed");
        conn
    }

    fn dummy_create(name: &str) -> CreateAccount {
        CreateAccount {
            name: name.to_string(),
            issuer: Some("Test".to_string()),
            secret_cipher: vec![0u8; 29],
            algorithm: None,
            digits: None,
            period: None,
            icon: None,
            color: None,
            group_id: None,
        }
    }

    #[test]
    fn create_and_list() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        repo.create(dummy_create("alice")).expect("create alice");
        repo.create(dummy_create("bob")).expect("create bob");
        let list = repo.list_with_cipher().expect("list must succeed");
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn create_returns_correct_name() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let acc = repo.create(dummy_create("carol")).expect("create must succeed");
        assert_eq!(acc.name, "carol");
    }

    #[test]
    fn get_by_id() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let created = repo.create(dummy_create("dave")).expect("create must succeed");
        let fetched = repo.get(created.id).expect("get must succeed");
        assert_eq!(fetched.id, created.id);
    }

    #[test]
    fn get_nonexistent_returns_not_found() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let err = repo.get(999).expect_err("must return not found");
        assert!(matches!(err, crate::error::AppError::NotFound));
    }

    #[test]
    fn delete_removes_account() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let acc = repo.create(dummy_create("eve")).expect("create must succeed");
        repo.delete(acc.id).expect("delete must succeed");
        assert_eq!(repo.list_with_cipher().expect("list must succeed").len(), 0);
    }

    #[test]
    fn get_secret_cipher() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let cipher = vec![42u8; 29];
        let mut inp = dummy_create("frank");
        inp.secret_cipher = cipher.clone();
        let acc = repo.create(inp).expect("create must succeed");
        assert_eq!(repo.get_secret_cipher(acc.id).expect("cipher fetch"), cipher);
    }

    #[test]
    fn reorder_accounts() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let a = repo.create(dummy_create("a")).expect("create a");
        let b = repo.create(dummy_create("b")).expect("create b");
        repo.reorder(&[b.id, a.id]).expect("reorder must succeed");
        let list: Vec<_> = repo.list_with_cipher().expect("list must succeed").into_iter().map(|(acc, _)| acc).collect();
        assert_eq!(list[0].id, b.id);
        assert_eq!(list[1].id, a.id);
    }
}
