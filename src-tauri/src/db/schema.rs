pub const SCHEMA_V1: &str = "
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
pub const MIGRATIONS: &[&str] = &[SCHEMA_V1];
