use rusqlite::Connection;
use secrecy::{ExposeSecret, Secret};
use std::sync::Mutex;

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
}
