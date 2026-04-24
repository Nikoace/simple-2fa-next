use rusqlite::Connection;
use secrecy::{ExposeSecret, Secret};
use std::sync::Mutex;

use crate::sync::SyncStatus;

pub struct VaultState {
    pub key: Secret<[u8; 32]>,
    pub master_password: Secret<String>,
}

impl VaultState {
    pub fn key_bytes(&self) -> &[u8; 32] {
        self.key.expose_secret()
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub vault: Mutex<Option<VaultState>>,
    pub sync_status: Mutex<SyncStatus>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self {
            db: Mutex::new(conn),
            vault: Mutex::new(None),
            sync_status: Mutex::new(SyncStatus {
                last_sync: None,
                last_error: None,
                in_progress: false,
            }),
        }
    }
}
