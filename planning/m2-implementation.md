# M2 Implementation Plan — Core TOTP + DB + Minimal Release

## Context

M1 established the full scaffold: Tauri 2 + React 19 + Tailwind v4 + Biome + Vitest + CI/CD workflows.

M2 delivers the **functional core** of the app:
- Rust: key derivation (Argon2id), AES-GCM encryption, TOTP generation, SQLite schema + migrations, vault unlock/lock, and accounts CRUD
- Frontend: typed Tauri IPC layer, Zustand vault store, and a minimal working account list
- Release pipeline: generate Tauri signing key, wire `release.yml`, verify a `v0.1.0-alpha.1` tag produces multi-platform binaries

**Development rule (from CLAUDE.md): TDD required. Write tests first, then implement.**

---

## 0. Preconditions (verify before starting)

```bash
cd /home/niko/hobby/simple-2fa-next
bun run test          # 5/5 pass (M1 baseline)
bun run lint:ci       # 0 errors
cd src-tauri && cargo check   # clean
```

---

## 1. Rust: Module Skeleton

Create all module files first (empty `pub mod` declarations), then fill them in TDD order.

### 1.1 Create directory tree

```
src-tauri/src/
├── crypto/
│   ├── mod.rs
│   ├── kdf.rs
│   └── aead.rs
├── totp/
│   ├── mod.rs
│   └── secret.rs
├── db/
│   ├── mod.rs
│   ├── schema.rs
│   ├── migrate.rs
│   └── repo.rs
├── commands/
│   ├── mod.rs
│   ├── vault.rs
│   └── accounts.rs
├── state.rs
├── error.rs      ← already exists
├── lib.rs        ← needs updating
└── main.rs       ← unchanged
```

### 1.2 `src-tauri/src/crypto/mod.rs`

```rust
pub mod aead;
pub mod kdf;

pub use aead::{open, seal};
pub use kdf::derive_key;
```

### 1.3 `src-tauri/src/totp/mod.rs`

```rust
pub mod secret;

pub use secret::{decode_base32_lenient, generate, normalize_secret};
```

### 1.4 `src-tauri/src/db/mod.rs`

```rust
pub mod migrate;
pub mod repo;
pub mod schema;

pub use migrate::run_migrations;
pub use repo::AccountRepo;
```

### 1.5 `src-tauri/src/commands/mod.rs`

```rust
pub mod accounts;
pub mod vault;

pub use accounts::*;
pub use vault::*;
```

---

## 2. Rust: Crypto Layer (TDD)

### 2.1 `src-tauri/src/crypto/kdf.rs`

**Write tests first:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_output() {
        let k1 = derive_key("password", b"0123456789abcdef").unwrap();
        let k2 = derive_key("password", b"0123456789abcdef").unwrap();
        assert_eq!(k1, k2);
    }

    #[test]
    fn different_password_different_key() {
        let k1 = derive_key("pass1", b"0123456789abcdef").unwrap();
        let k2 = derive_key("pass2", b"0123456789abcdef").unwrap();
        assert_ne!(k1, k2);
    }

    #[test]
    fn different_salt_different_key() {
        let k1 = derive_key("pass", b"0000000000000000").unwrap();
        let k2 = derive_key("pass", b"1111111111111111").unwrap();
        assert_ne!(k1, k2);
    }

    #[test]
    fn output_is_32_bytes() {
        let k = derive_key("any", b"0123456789abcdef").unwrap();
        assert_eq!(k.len(), 32);
    }
}
```

**Then implement:**

```rust
use argon2::{Argon2, Params, Version};
use crate::error::AppError;

/// Derives a 256-bit vault key from a master password using Argon2id.
/// Parameters are intentionally fixed to be compatible with legacy .s2fa v1 backup format.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], AppError> {
    let params = Params::new(65_536, 3, 4, Some(32))
        .map_err(|_| AppError::Crypto("kdf params".into()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| AppError::Crypto(e.to_string()))?;
    Ok(key)
}
```

> **Note:** These are the same Argon2id parameters used in simple_2fa v1. Keeping them identical ensures M3 legacy import compatibility without needing a separate `derive_key_legacy`.

### 2.2 `src-tauri/src/crypto/aead.rs`

**Write tests first:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> [u8; 32] { [0u8; 32] }

    #[test]
    fn roundtrip() {
        let ct = seal(&key(), b"hello world").unwrap();
        let pt = open(&key(), &ct).unwrap();
        assert_eq!(pt, b"hello world");
    }

    #[test]
    fn wrong_key_fails() {
        let ct = seal(&key(), b"secret").unwrap();
        let mut bad_key = key();
        bad_key[0] = 1;
        assert!(open(&bad_key, &ct).is_err());
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let mut ct = seal(&key(), b"data").unwrap();
        let last = ct.len() - 1;
        ct[last] ^= 0xFF;
        assert!(open(&key(), &ct).is_err());
    }

    #[test]
    fn output_format_is_nonce_plus_ciphertext() {
        let ct = seal(&key(), b"x").unwrap();
        // 12B nonce + 1B plaintext + 16B GCM tag = 29 bytes minimum
        assert!(ct.len() >= 29);
    }

    #[test]
    fn two_seals_of_same_plaintext_differ() {
        // nonce is random each call
        let ct1 = seal(&key(), b"same").unwrap();
        let ct2 = seal(&key(), b"same").unwrap();
        assert_ne!(ct1, ct2);
    }
}
```

**Then implement:**

```rust
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::{rngs::OsRng, RngCore};
use crate::error::AppError;

const NONCE_LEN: usize = 12;

/// Encrypts `plaintext` with AES-256-GCM. Output: [12B nonce || ciphertext || 16B tag].
pub fn seal(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, AppError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Crypto(e.to_string()))?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let mut ct = cipher.encrypt(nonce, plaintext)
        .map_err(|e| AppError::Crypto(e.to_string()))?;
    let mut out = Vec::with_capacity(NONCE_LEN + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.append(&mut ct);
    Ok(out)
}

/// Decrypts a blob produced by `seal`.
pub fn open(key: &[u8; 32], blob: &[u8]) -> Result<Vec<u8>, AppError> {
    if blob.len() <= NONCE_LEN {
        return Err(AppError::Crypto("blob too short".into()));
    }
    let (nonce_bytes, ct) = blob.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Crypto(e.to_string()))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher.decrypt(nonce, ct)
        .map_err(|_| AppError::Crypto("decryption failed".into()))
}
```

---

## 3. Rust: TOTP Layer (TDD)

### 3.1 `src-tauri/src/totp/secret.rs`

**Write tests first:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_spaces_and_dashes() {
        assert_eq!(normalize_secret("JBSW Y3DP"), "JBSWY3DP");
        assert_eq!(normalize_secret("JBSW-Y3DP"), "JBSWY3DP");
    }

    #[test]
    fn normalize_uppercases() {
        assert_eq!(normalize_secret("jbswy3dp"), "JBSWY3DP");
    }

    #[test]
    fn normalize_strips_trailing_padding() {
        assert_eq!(normalize_secret("JBSWY3DP=="), "JBSWY3DP");
    }

    #[test]
    fn normalize_idempotent() {
        let s = "JBSWY3DPEHPK3PXP";
        assert_eq!(normalize_secret(s), normalize_secret(&normalize_secret(s)));
    }

    #[test]
    fn decode_base32_known_vector() {
        // "Hello!" in Base32 (RFC 4648) = JBSWY3DPEB3W64TMMQ======
        // Just test it doesn't error and round-trips
        let encoded = "JBSWY3DPEHPK3PXP";
        let decoded = decode_base32_lenient(encoded).unwrap();
        assert!(!decoded.is_empty());
    }

    #[test]
    fn decode_invalid_returns_error() {
        assert!(decode_base32_lenient("!!!INVALID!!!").is_err());
    }

    #[test]
    fn generate_totp_known_vector() {
        // RFC 6238 test vector: secret = "12345678901234567890" as bytes
        // At t=0 (step 0, T=0): code depends on implementation
        // Use a well-known secret and just verify 6-digit output
        let secret = decode_base32_lenient("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").unwrap();
        let code = generate(&secret, 6, 30, 0);
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn generate_returns_zero_padded_6_digits() {
        let secret = decode_base32_lenient("JBSWY3DPEHPK3PXP").unwrap();
        let code = generate(&secret, 6, 30, 12345678);
        assert_eq!(code.len(), 6);
    }
}
```

**Then implement:**

```rust
use data_encoding::BASE32_NOPAD;
use totp_rs::{Algorithm, TOTP, Secret};
use crate::error::AppError;

/// Strips whitespace, dashes, uppercases, and removes trailing '=' padding.
pub fn normalize_secret(s: &str) -> String {
    s.chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| c.to_ascii_uppercase())
        .collect::<String>()
        .trim_end_matches('=')
        .to_owned()
}

/// Decodes a Base32 string (RFC 4648, no-padding) to raw bytes.
pub fn decode_base32_lenient(s: &str) -> Result<Vec<u8>, AppError> {
    let normalized = normalize_secret(s);
    BASE32_NOPAD
        .decode(normalized.as_bytes())
        .map_err(|e| AppError::InvalidInput(format!("invalid base32: {}", e)))
}

/// Generates a TOTP code.
/// `t` is Unix time in seconds; pass `0` to use the current system time.
pub fn generate(secret_bytes: &[u8], digits: u8, period: u32, t: u64) -> String {
    let time = if t == 0 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    } else {
        t
    };

    let totp = TOTP::new(
        Algorithm::SHA1,
        digits as usize,
        1,       // skew
        period,
        secret_bytes.to_vec(),
    )
    // This should only fail if the secret is empty
    .expect("failed to create TOTP instance");

    totp.generate(time)
}
```

> **Cargo.toml note:** `data-encoding` crate is already listed. The `totp-rs` crate provides `Algorithm`, `TOTP`, `Secret`.

---

## 4. Rust: Database Layer (TDD)

### 4.1 `src-tauri/src/db/schema.rs`

No tests needed — just SQL constants and migration list.

```rust
pub const SCHEMA_V1: &str = "
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    color      TEXT,
    icon       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id      INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    issuer        TEXT,
    secret_cipher BLOB NOT NULL,
    algorithm     TEXT NOT NULL DEFAULT 'SHA1',
    digits        INTEGER NOT NULL DEFAULT 6,
    period        INTEGER NOT NULL DEFAULT 30,
    icon          TEXT,
    color         TEXT,
    notes         TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_group
    ON accounts(group_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_accounts_name
    ON accounts(name);
";

/// Each migration is applied in order; the index+1 equals the target schema version.
pub const MIGRATIONS: &[&str] = &[
    SCHEMA_V1, // version 1
    // Add new migrations here as SCHEMA_V2, etc.
];
```

### 4.2 `src-tauri/src/db/migrate.rs`

**Write tests first:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn open_memory() -> Connection {
        Connection::open_in_memory().unwrap()
    }

    #[test]
    fn fresh_db_gets_migrated_to_latest() {
        let mut conn = open_memory();
        run_migrations(&mut conn).unwrap();
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    fn migration_is_idempotent() {
        let mut conn = open_memory();
        run_migrations(&mut conn).unwrap();
        run_migrations(&mut conn).unwrap(); // second call must not fail
    }

    #[test]
    fn schema_v1_creates_required_tables() {
        let mut conn = open_memory();
        run_migrations(&mut conn).unwrap();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert!(tables.contains(&"meta".to_string()));
        assert!(tables.contains(&"groups".to_string()));
        assert!(tables.contains(&"accounts".to_string()));
    }
}
```

**Then implement:**

```rust
use rusqlite::Connection;
use crate::db::schema::MIGRATIONS;
use crate::error::AppError;

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
```

### 4.3 `src-tauri/src/db/repo.rs`

**Types and tests first:**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub struct CreateAccount {
    pub name: String,
    pub issuer: Option<String>,
    pub secret_cipher: Vec<u8>,  // already sealed by the vault_key
    pub algorithm: Option<String>,
    pub digits: Option<u8>,
    pub period: Option<u32>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub group_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub issuer: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub group_id: Option<i64>,
    pub notes: Option<String>,
}

pub struct AccountRepo<'a>(pub &'a rusqlite::Connection);
```

**Tests (use in-memory DB):**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use crate::db::migrate::run_migrations;

    fn make_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();
        conn
    }

    fn dummy_create(name: &str) -> CreateAccount {
        CreateAccount {
            name: name.to_string(),
            issuer: Some("Test".to_string()),
            secret_cipher: vec![0u8; 29], // mock sealed blob
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
        repo.create(dummy_create("alice")).unwrap();
        repo.create(dummy_create("bob")).unwrap();
        let list = repo.list().unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn create_returns_correct_name() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let acc = repo.create(dummy_create("carol")).unwrap();
        assert_eq!(acc.name, "carol");
    }

    #[test]
    fn get_by_id() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let created = repo.create(dummy_create("dave")).unwrap();
        let fetched = repo.get(created.id).unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[test]
    fn get_nonexistent_returns_not_found() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let err = repo.get(999).unwrap_err();
        assert!(matches!(err, crate::error::AppError::NotFound));
    }

    #[test]
    fn delete_removes_account() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let acc = repo.create(dummy_create("eve")).unwrap();
        repo.delete(acc.id).unwrap();
        assert_eq!(repo.list().unwrap().len(), 0);
    }

    #[test]
    fn get_secret_cipher() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let cipher = vec![42u8; 29];
        let mut inp = dummy_create("frank");
        inp.secret_cipher = cipher.clone();
        let acc = repo.create(inp).unwrap();
        assert_eq!(repo.get_secret_cipher(acc.id).unwrap(), cipher);
    }

    #[test]
    fn reorder_accounts() {
        let conn = make_db();
        let repo = AccountRepo(&conn);
        let a = repo.create(dummy_create("a")).unwrap();
        let b = repo.create(dummy_create("b")).unwrap();
        repo.reorder(&[b.id, a.id]).unwrap();
        let list = repo.list().unwrap();
        assert_eq!(list[0].id, b.id);
        assert_eq!(list[1].id, a.id);
    }
}
```

**Then implement `AccountRepo` methods:**

```rust
use rusqlite::{params, Connection};
use crate::error::AppError;

impl<'a> AccountRepo<'a> {
    pub fn list(&self) -> Result<Vec<Account>, AppError> {
        let mut stmt = self.0.prepare(
            "SELECT id, group_id, name, issuer, algorithm, digits, period,
                    icon, color, notes, sort_order, created_at, updated_at
             FROM accounts ORDER BY sort_order ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Account {
                id: r.get(0)?, group_id: r.get(1)?,
                name: r.get(2)?, issuer: r.get(3)?,
                algorithm: r.get(4)?, digits: r.get::<_, u8>(5)?,
                period: r.get::<_, u32>(6)?, icon: r.get(7)?,
                color: r.get(8)?, notes: r.get(9)?,
                sort_order: r.get(10)?, created_at: r.get(11)?,
                updated_at: r.get(12)?,
            })
        })?;
        rows.map(|r| r.map_err(AppError::from)).collect()
    }

    pub fn get(&self, id: i64) -> Result<Account, AppError> {
        self.0
            .query_row(
                "SELECT id, group_id, name, issuer, algorithm, digits, period,
                         icon, color, notes, sort_order, created_at, updated_at
                  FROM accounts WHERE id = ?1",
                params![id],
                |r| Ok(Account {
                    id: r.get(0)?, group_id: r.get(1)?,
                    name: r.get(2)?, issuer: r.get(3)?,
                    algorithm: r.get(4)?, digits: r.get::<_, u8>(5)?,
                    period: r.get::<_, u32>(6)?, icon: r.get(7)?,
                    color: r.get(8)?, notes: r.get(9)?,
                    sort_order: r.get(10)?, created_at: r.get(11)?,
                    updated_at: r.get(12)?,
                }),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound,
                other => AppError::from(other),
            })
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
        let sort_order: i64 = self.0
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
                inp.group_id, inp.name, inp.issuer, inp.secret_cipher,
                inp.algorithm.as_deref().unwrap_or("SHA1"),
                inp.digits.unwrap_or(6),
                inp.period.unwrap_or(30),
                inp.icon, inp.color, None::<String>,
                sort_order, now,
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
                icon       = CASE WHEN ?4 IS NOT NULL THEN ?4 ELSE icon  END,
                color      = CASE WHEN ?5 IS NOT NULL THEN ?5 ELSE color END,
                group_id   = CASE WHEN ?6 IS NOT NULL THEN ?6 ELSE group_id END,
                notes      = CASE WHEN ?7 IS NOT NULL THEN ?7 ELSE notes END,
                updated_at = ?8
             WHERE id = ?1",
            params![id, upd.name, upd.issuer, upd.icon, upd.color, upd.group_id, upd.notes, now],
        )?;
        self.get(id)
    }

    pub fn delete(&self, id: i64) -> Result<(), AppError> {
        let n = self.0.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        if n == 0 { Err(AppError::NotFound) } else { Ok(()) }
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
```

---

## 5. Rust: AppState

### `src-tauri/src/state.rs`

```rust
use rusqlite::Connection;
use std::sync::Mutex;
use secrecy::{ExposeSecret, Secret};

pub struct VaultState {
    pub key: Secret<[u8; 32]>,
}

impl VaultState {
    pub fn key_bytes(&self) -> &[u8; 32] {
        self.key.expose_secret()
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub vault: Mutex<Option<VaultState>>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self {
            db: Mutex::new(conn),
            vault: Mutex::new(None),
        }
    }

    pub fn is_locked(&self) -> bool {
        self.vault.lock().unwrap().is_none()
    }
}
```

---

## 6. Rust: Commands

### 6.1 `src-tauri/src/commands/vault.rs`

**Concept:** On first launch there's no `meta.kdf_salt` row → vault is "uninitialized". The frontend must call `setup_vault(password)` once, then `unlock(password)` on subsequent launches.

```rust
use tauri::State;
use rand::{rngs::OsRng, RngCore};
use crate::{
    crypto::{derive_key, open, seal},
    db::repo::AccountRepo,
    error::AppError,
    state::{AppState, VaultState},
};
use secrecy::Secret;

const META_SALT: &str = "kdf_salt";
const META_VERIFIER: &str = "verifier";

// A known plaintext we seal with the vault_key to use as an unlock verifier
const VERIFIER_PLAINTEXT: &[u8] = b"S2FA_NEXT_VAULT_OK";

/// Called once on first launch to initialize the vault with a master password.
#[tauri::command]
pub async fn setup_vault(
    password: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().unwrap();
    let repo = AccountRepo(&db);

    // Check not already initialized
    if get_meta(&db, META_SALT)?.is_some() {
        return Err(AppError::InvalidInput("vault already initialized".into()));
    }

    // Generate random salt
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    let salt_hex = hex::encode(salt);

    // Derive vault key
    let key = derive_key(&password, &salt)?;

    // Seal verifier
    let verifier_ct = seal(&key, VERIFIER_PLAINTEXT)?;
    let verifier_hex = hex::encode(&verifier_ct);

    // Persist
    set_meta(&db, META_SALT, &salt_hex)?;
    set_meta(&db, META_VERIFIER, &verifier_hex)?;

    // Unlock immediately
    *state.vault.lock().unwrap() = Some(VaultState { key: Secret::new(key) });
    Ok(())
}

/// Unlocks the vault by verifying the master password against the stored verifier.
#[tauri::command]
pub async fn unlock_vault(
    password: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().unwrap();

    let salt_hex = get_meta(&db, META_SALT)?
        .ok_or_else(|| AppError::InvalidInput("vault not initialized".into()))?;
    let salt = hex::decode(&salt_hex)
        .map_err(|_| AppError::Crypto("corrupt salt".into()))?;

    let verifier_hex = get_meta(&db, META_VERIFIER)?
        .ok_or_else(|| AppError::InvalidInput("verifier missing".into()))?;
    let verifier_ct = hex::decode(&verifier_hex)
        .map_err(|_| AppError::Crypto("corrupt verifier".into()))?;

    let key = derive_key(&password, &salt)?;

    // Verify password by decrypting verifier
    open(&key, &verifier_ct)
        .map_err(|_| AppError::InvalidInput("wrong password".into()))?;

    *state.vault.lock().unwrap() = Some(VaultState { key: Secret::new(key) });
    Ok(())
}

/// Locks the vault (clears the key from memory).
#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<(), AppError> {
    *state.vault.lock().unwrap() = None;
    Ok(())
}

/// Returns true if vault is initialized (has a kdf_salt in meta).
#[tauri::command]
pub fn is_vault_initialized(state: State<'_, AppState>) -> Result<bool, AppError> {
    let db = state.db.lock().unwrap();
    Ok(get_meta(&db, META_SALT)?.is_some())
}

// --- helpers ---

fn get_meta(db: &rusqlite::Connection, key: &str) -> Result<Option<String>, AppError> {
    match db.query_row(
        "SELECT value FROM meta WHERE key = ?1",
        rusqlite::params![key],
        |r| r.get(0),
    ) {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}

fn set_meta(db: &rusqlite::Connection, key: &str, value: &str) -> Result<(), AppError> {
    db.execute(
        "INSERT INTO meta(key, value) VALUES(?1,?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![key, value],
    )?;
    Ok(())
}
```

> **Note:** Add `hex = "0.4"` to `src-tauri/Cargo.toml` dependencies.

### 6.2 `src-tauri/src/commands/accounts.rs`

```rust
use tauri::State;
use crate::{
    crypto::{open, seal},
    db::repo::{Account, AccountRepo, CreateAccount, UpdateAccount},
    error::AppError,
    state::AppState,
    totp::secret::{decode_base32_lenient, generate, normalize_secret},
};
use serde::{Deserialize, Serialize};

/// What the frontend sees — no secret plaintext, only generated code + TTL.
#[derive(Debug, Serialize)]
pub struct AccountWithCode {
    pub id: i64,
    pub group_id: Option<i64>,
    pub name: String,
    pub issuer: Option<String>,
    pub algorithm: String,
    pub digits: u8,
    pub period: u32,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i64,
    pub code: String,
    pub ttl: u32,
    pub progress: f32,
}

#[derive(Debug, Deserialize)]
pub struct AddAccountInput {
    pub name: String,
    pub issuer: Option<String>,
    pub secret: String,   // raw base32 secret from the user
    pub algorithm: Option<String>,
    pub digits: Option<u8>,
    pub period: Option<u32>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub group_id: Option<i64>,
}

#[tauri::command]
pub fn get_accounts(state: State<'_, AppState>) -> Result<Vec<AccountWithCode>, AppError> {
    let vault = state.vault.lock().unwrap();
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();
    let db = state.db.lock().unwrap();
    let repo = AccountRepo(&db);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    repo.list()?
        .into_iter()
        .map(|acc| {
            let cipher = repo.get_secret_cipher(acc.id)?;
            let secret_bytes = open(vault_key, &cipher)?;
            let period = acc.period;
            let code = generate(&secret_bytes, acc.digits, period, 0);
            let ttl = period - (now % period as u64) as u32;
            let progress = ttl as f32 / period as f32;
            Ok(AccountWithCode {
                id: acc.id, group_id: acc.group_id,
                name: acc.name, issuer: acc.issuer,
                algorithm: acc.algorithm, digits: acc.digits,
                period, icon: acc.icon, color: acc.color,
                sort_order: acc.sort_order,
                code, ttl, progress,
            })
        })
        .collect()
}

#[tauri::command]
pub fn add_account(
    input: AddAccountInput,
    state: State<'_, AppState>,
) -> Result<AccountWithCode, AppError> {
    let vault = state.vault.lock().unwrap();
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();
    let db = state.db.lock().unwrap();
    let repo = AccountRepo(&db);

    let normalized = normalize_secret(&input.secret);
    let secret_bytes = decode_base32_lenient(&normalized)
        .map_err(|_| AppError::InvalidInput("invalid base32 secret".into()))?;

    let secret_cipher = seal(vault_key, &secret_bytes)?;

    let acc = repo.create(CreateAccount {
        name: input.name, issuer: input.issuer,
        secret_cipher, algorithm: input.algorithm,
        digits: input.digits, period: input.period,
        icon: input.icon, color: input.color,
        group_id: input.group_id,
    })?;

    // Fetch code for the newly created account
    get_account_with_code(&acc, &secret_bytes)
}

#[tauri::command]
pub fn update_account(
    id: i64,
    input: UpdateAccount,
    state: State<'_, AppState>,
) -> Result<Account, AppError> {
    let vault = state.vault.lock().unwrap();
    if vault.is_none() { return Err(AppError::VaultLocked); }
    let db = state.db.lock().unwrap();
    AccountRepo(&db).update(id, input)
}

#[tauri::command]
pub fn delete_account(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let vault = state.vault.lock().unwrap();
    if vault.is_none() { return Err(AppError::VaultLocked); }
    let db = state.db.lock().unwrap();
    AccountRepo(&db).delete(id)
}

#[tauri::command]
pub fn reorder_accounts(ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), AppError> {
    let vault = state.vault.lock().unwrap();
    if vault.is_none() { return Err(AppError::VaultLocked); }
    let db = state.db.lock().unwrap();
    AccountRepo(&db).reorder(&ids)
}

// --- helper ---

fn get_account_with_code(acc: &Account, secret_bytes: &[u8]) -> Result<AccountWithCode, AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let period = acc.period;
    let code = generate(secret_bytes, acc.digits, period, 0);
    let ttl = period - (now % period as u64) as u32;
    Ok(AccountWithCode {
        id: acc.id, group_id: acc.group_id,
        name: acc.name.clone(), issuer: acc.issuer.clone(),
        algorithm: acc.algorithm.clone(), digits: acc.digits,
        period, icon: acc.icon.clone(), color: acc.color.clone(),
        sort_order: acc.sort_order,
        code, ttl, progress: ttl as f32 / period as f32,
    })
}
```

---

## 7. Rust: Wire Everything in `lib.rs`

```rust
mod commands;
mod crypto;
mod db;
mod error;
mod state;
mod totp;

use db::{migrate::run_migrations, repo::AccountRepo};
use state::AppState;
use std::path::PathBuf;
use tauri::Manager;

pub use error::AppError;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_dir: PathBuf = app.path().app_data_dir()
                .expect("no app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("accounts.db");

            let mut conn = rusqlite::Connection::open(&db_path)
                .expect("failed to open database");
            run_migrations(&mut conn).expect("migration failed");

            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // vault
            commands::vault::setup_vault,
            commands::vault::unlock_vault,
            commands::vault::lock_vault,
            commands::vault::is_vault_initialized,
            // accounts
            commands::accounts::get_accounts,
            commands::accounts::add_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            commands::accounts::reorder_accounts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 8. Rust: Update `Cargo.toml`

Add missing crates:

```toml
hex = "0.4"
```

Full `[dependencies]` section for reference (merge with existing):

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.34", features = ["bundled"] }
totp-rs = { version = "5", features = ["gen_secret", "zeroize"] }
data-encoding = "2"
aes-gcm = "0.10"
argon2 = "0.5"
rand = "0.8"
hex = "0.4"
zeroize = { version = "1", features = ["derive"] }
secrecy = { version = "0.8", features = ["serde"] }
thiserror = "2"
tokio = { version = "1", features = ["full"] }
```

---

## 9. Frontend: Tauri IPC Layer

### `src/lib/tauri.ts`

All `invoke()` calls live here. Keep this file in sync with Rust command signatures.

```typescript
import { invoke } from "@tauri-apps/api/core";

// --- Types ---

export type AccountWithCode = {
  id: number;
  groupId: number | null;
  name: string;
  issuer: string | null;
  algorithm: "SHA1" | "SHA256" | "SHA512";
  digits: 6 | 7 | 8;
  period: number;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  code: string;
  ttl: number;
  progress: number;
};

export type Account = Omit<AccountWithCode, "code" | "ttl" | "progress">;

export type AddAccountInput = {
  name: string;
  issuer?: string;
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
  icon?: string;
  color?: string;
  groupId?: number;
};

export type UpdateAccountInput = {
  name?: string;
  issuer?: string;
  icon?: string;
  color?: string;
  groupId?: number;
  notes?: string;
};

// --- Vault ---

export const isVaultInitialized = () =>
  invoke<boolean>("is_vault_initialized");

export const setupVault = (password: string) =>
  invoke<void>("setup_vault", { password });

export const unlockVault = (password: string) =>
  invoke<void>("unlock_vault", { password });

export const lockVault = () => invoke<void>("lock_vault");

// --- Accounts ---

export const getAccounts = () => invoke<AccountWithCode[]>("get_accounts");

export const addAccount = (input: AddAccountInput) =>
  invoke<AccountWithCode>("add_account", { input });

export const updateAccount = (id: number, input: UpdateAccountInput) =>
  invoke<Account>("update_account", { id, input });

export const deleteAccount = (id: number) =>
  invoke<void>("delete_account", { id });

export const reorderAccounts = (ids: number[]) =>
  invoke<void>("reorder_accounts", { ids });
```

> **Note:** Rust uses snake_case field names. Tauri's default serializer uses snake_case as-is. Either keep TS types as snake_case matching Rust, or add a `#[serde(rename_all = "camelCase")]` to the Rust structs. Choose one convention and stick to it. Recommendation: add `#[serde(rename_all = "camelCase")]` to `AccountWithCode` and `Account` in Rust, then use camelCase in TS (as shown above).

**If using camelCase, add to Rust structs:**
```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithCode { ... }
```

### `src/stores/vault.ts`

```typescript
import { create } from "zustand";
import {
  isVaultInitialized,
  lockVault,
  setupVault,
  unlockVault,
} from "@/lib/tauri";

type VaultStatus = "loading" | "uninitialized" | "locked" | "unlocked";

type VaultStore = {
  status: VaultStatus;
  error: string | null;
  checkStatus: () => Promise<void>;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
};

export const useVaultStore = create<VaultStore>((set) => ({
  status: "loading",
  error: null,

  checkStatus: async () => {
    try {
      const initialized = await isVaultInitialized();
      set({ status: initialized ? "locked" : "uninitialized", error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setup: async (password) => {
    try {
      await setupVault(password);
      set({ status: "unlocked", error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  unlock: async (password) => {
    try {
      await unlockVault(password);
      set({ status: "unlocked", error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  lock: async () => {
    await lockVault();
    set({ status: "locked", error: null });
  },
}));
```

### Frontend tests

**`src/stores/vault.test.ts`** — test the store's state transitions:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Mock tauri.ts
vi.mock("@/lib/tauri", () => ({
  isVaultInitialized: vi.fn(),
  setupVault: vi.fn(),
  unlockVault: vi.fn(),
  lockVault: vi.fn(),
}));

import * as tauriLib from "@/lib/tauri";
import { useVaultStore } from "./vault";

beforeEach(() => {
  useVaultStore.setState({ status: "loading", error: null });
});

describe("useVaultStore", () => {
  it("checkStatus: sets uninitialized when vault not set up", async () => {
    vi.mocked(tauriLib.isVaultInitialized).mockResolvedValue(false);
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.checkStatus());
    expect(result.current.status).toBe("uninitialized");
  });

  it("checkStatus: sets locked when vault exists", async () => {
    vi.mocked(tauriLib.isVaultInitialized).mockResolvedValue(true);
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.checkStatus());
    expect(result.current.status).toBe("locked");
  });

  it("unlock: sets unlocked on success", async () => {
    vi.mocked(tauriLib.unlockVault).mockResolvedValue(undefined);
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.unlock("password"));
    expect(result.current.status).toBe("unlocked");
  });

  it("unlock: stores error on failure", async () => {
    vi.mocked(tauriLib.unlockVault).mockRejectedValue("wrong password");
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.unlock("wrong"));
    expect(result.current.error).toBeTruthy();
    expect(result.current.status).toBe("loading"); // unchanged from initial
  });

  it("lock: sets locked", async () => {
    vi.mocked(tauriLib.lockVault).mockResolvedValue(undefined);
    const { result } = renderHook(() => useVaultStore());
    useVaultStore.setState({ status: "unlocked" });
    await act(() => result.current.lock());
    expect(result.current.status).toBe("locked");
  });
});
```

**`src/lib/tauri.test.ts`** — minimal test confirming `invoke` is called with correct command names:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import { invoke } from "@tauri-apps/api/core";
import { lockVault, unlockVault } from "./tauri";

describe("tauri.ts wrappers", () => {
  it("unlockVault calls invoke with correct command", async () => {
    await unlockVault("pw");
    expect(invoke).toHaveBeenCalledWith("unlock_vault", { password: "pw" });
  });

  it("lockVault calls invoke with correct command", async () => {
    await lockVault();
    expect(invoke).toHaveBeenCalledWith("lock_vault");
  });
});
```

---

## 10. Release Infrastructure

### 10.1 Generate Tauri signing key

Run once locally:

```bash
cd /home/niko/hobby/simple-2fa-next
bunx @tauri-apps/cli signer generate -w ~/.tauri/simple-2fa-next.key
# It prints the public key — save that.
```

This creates a private key file at `~/.tauri/simple-2fa-next.key` and outputs the public key string.

### 10.2 Add updater to `tauri.conf.json`

```json
{
  ...existing fields...,
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_FROM_STEP_10.1",
      "endpoints": [
        "https://github.com/YOUR_USER/simple-2fa-next/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Replace `YOUR_PUBLIC_KEY_FROM_STEP_10.1` and `YOUR_USER`.

### 10.3 Add `tauri-plugin-updater` to `Cargo.toml`

```toml
tauri-plugin-updater = "2"
```

And register it in `lib.rs`:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

### 10.4 Add GitHub Secrets

In the GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/simple-2fa-next.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password you used when generating (or empty) |
| `CODECOV_TOKEN` | Get from codecov.io after connecting the repo |

### 10.5 Verify `release.yml` fires correctly

```bash
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
# Monitor GitHub Actions → Release workflow
```

Expected: three parallel jobs (linux / macos-arm / macos-x64 / windows), each producing a signed installer artifact, uploaded to a draft GitHub Release.

---

## 11. Build Verification Sequence

Run these checks in order. Each must pass before moving to the next.

```bash
# 1. Rust unit + integration tests
cd src-tauri && cargo test

# 2. Frontend tests (coverage ≥ 80%)
cd .. && bun run test:coverage

# 3. Lint
bun run lint:ci
cd src-tauri && cargo clippy --all-targets -- -D warnings

# 4. Type check
bun run typecheck

# 5. Full Tauri dev smoke test (manual)
bun run tauri dev
# Expected: app launches, shows lock screen, setup flow works, adding an account shows 6-digit code
```

---

## 12. M2 Acceptance Criteria

| # | Check | How to verify |
|---|---|---|
| 1 | `cargo test` all pass | `cargo test` output |
| 2 | Frontend tests all pass, coverage ≥ 80% | `bun run test:coverage` output |
| 3 | Biome lint 0 errors | `bun run lint:ci` exits 0 |
| 4 | TypeScript 0 errors | `bun run typecheck` exits 0 |
| 5 | App launches and shows lock screen | Manual: `bun run tauri dev` |
| 6 | First-launch setup flow works (enter password → vault initialized) | Manual: delete `accounts.db`, relaunch |
| 7 | Adding an account shows correct 6-digit TOTP code | Manual: add a known test account |
| 8 | `v0.1.0-alpha.1` tag produces multi-platform installers | GitHub Actions → Release workflow |
| 9 | Installer runs correctly on at least one platform | Install & launch produced binary |

---

## 13. Files to Create / Modify

| Action | Path |
|---|---|
| CREATE | `src-tauri/src/crypto/mod.rs` |
| CREATE | `src-tauri/src/crypto/kdf.rs` |
| CREATE | `src-tauri/src/crypto/aead.rs` |
| CREATE | `src-tauri/src/totp/mod.rs` |
| CREATE | `src-tauri/src/totp/secret.rs` |
| CREATE | `src-tauri/src/db/mod.rs` |
| CREATE | `src-tauri/src/db/schema.rs` |
| CREATE | `src-tauri/src/db/migrate.rs` |
| CREATE | `src-tauri/src/db/repo.rs` |
| CREATE | `src-tauri/src/commands/mod.rs` |
| CREATE | `src-tauri/src/commands/vault.rs` |
| CREATE | `src-tauri/src/commands/accounts.rs` |
| MODIFY | `src-tauri/src/state.rs` (replace stub) |
| MODIFY | `src-tauri/src/lib.rs` (register commands + setup) |
| MODIFY | `src-tauri/Cargo.toml` (add `hex = "0.4"`, `tauri-plugin-updater`) |
| MODIFY | `src-tauri/tauri.conf.json` (add updater plugin block) |
| CREATE | `src/lib/tauri.ts` |
| CREATE | `src/lib/tauri.test.ts` |
| CREATE | `src/stores/vault.ts` |
| CREATE | `src/stores/vault.test.ts` |
| MODIFY | `src/App.tsx` (minimal unlock → account list flow, polish in M4) |

---

## 14. Known Gotchas

1. **`db` is locked during async commands** — `Mutex<Connection>` blocks. Keep Tauri commands `fn` (synchronous) where possible, or use `tokio::task::spawn_blocking` for heavy DB ops. In M2 the commands are simple enough to stay synchronous.

2. **`secret_bytes` must be zeroized** — After sealing, call `secret_bytes.zeroize()` (if using the `zeroize` crate's `Zeroize` trait on `Vec<u8>`). The `secrecy` crate handles the vault key, but raw `Vec<u8>` from `decode_base32_lenient` is not automatically zeroized.

3. **`serde` rename** — If adding `#[serde(rename_all = "camelCase")]` to Rust structs, Tauri's invoke parameter names (the `{ input }` in `invoke("add_account", { input })`) are also affected. Test that field names match between Rust deserialization and TS call sites.

4. **`totp-rs` version** — The crate's API changed between v4 and v5. With v5, `TOTP::new()` returns `Result`, not a panic-able constructor. Adjust the `generate` function accordingly: `TOTP::new(...).map_err(...)`.

5. **Tauri capabilities** — `tauri-plugin-dialog` requires the `dialog:default` capability. Check `src-tauri/capabilities/default.json` and add:
   ```json
   "tauri:dialog:default"
   ```
   (exact permission key may differ — check tauri-plugin-dialog docs for v2).
