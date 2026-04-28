use rand::{rngs::OsRng, RngCore};
use secrecy::SecretBox;
use tauri::State;

use crate::{
    crypto::{derive_key, open, seal},
    error::AppError,
    state::{AppState, VaultState},
};

const META_SALT: &str = "kdf_salt";
const META_VERIFIER: &str = "verifier";
const VERIFIER_PLAINTEXT: &[u8] = b"S2FA_NEXT_VAULT_OK";

/// Called once on first launch to initialize the vault with a master password.
#[tauri::command]
pub fn setup_vault(password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let key = {
        let db = state.db.lock().expect("db lock poisoned");

        if get_meta(&db, META_SALT)?.is_some() {
            return Err(AppError::InvalidInput("vault already initialized".into()));
        }

        let mut salt = [0u8; 16];
        OsRng.fill_bytes(&mut salt);
        let salt_hex = hex::encode(salt);

        let key = derive_key(&password, &salt)?;
        let verifier_ct = seal(&key, VERIFIER_PLAINTEXT)?;
        let verifier_hex = hex::encode(verifier_ct);

        set_meta(&db, META_SALT, &salt_hex)?;
        set_meta(&db, META_VERIFIER, &verifier_hex)?;
        key
    }; // db lock released before vault lock is acquired

    *state.vault.lock().expect("vault lock poisoned") = Some(VaultState {
        key: SecretBox::new(Box::new(key)),
        master_password: SecretBox::new(Box::new(password)),
    });
    Ok(())
}

/// Unlocks the vault by verifying the master password against the stored verifier.
#[tauri::command]
pub fn unlock_vault(password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let key = {
        let db = state.db.lock().expect("db lock poisoned");

        let salt_hex = get_meta(&db, META_SALT)?
            .ok_or_else(|| AppError::InvalidInput("vault not initialized".into()))?;
        let salt = hex::decode(&salt_hex).map_err(|_| AppError::Crypto("corrupt salt".into()))?;

        let verifier_hex = get_meta(&db, META_VERIFIER)?
            .ok_or_else(|| AppError::InvalidInput("verifier missing".into()))?;
        let verifier_ct =
            hex::decode(&verifier_hex).map_err(|_| AppError::Crypto("corrupt verifier".into()))?;

        let key = derive_key(&password, &salt)?;
        open(&key, &verifier_ct).map_err(|_| AppError::InvalidInput("wrong password".into()))?;
        key
    }; // db lock released before vault lock is acquired

    *state.vault.lock().expect("vault lock poisoned") = Some(VaultState {
        key: SecretBox::new(Box::new(key)),
        master_password: SecretBox::new(Box::new(password)),
    });
    Ok(())
}

/// Locks the vault (clears the key from memory).
#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<(), AppError> {
    *state.vault.lock().expect("vault lock poisoned") = None;
    Ok(())
}

/// Returns true if vault is initialized (has a kdf_salt in meta).
#[tauri::command]
pub fn is_vault_initialized(state: State<'_, AppState>) -> Result<bool, AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    Ok(get_meta(&db, META_SALT)?.is_some())
}

pub(crate) fn verify_password(state: &AppState, password: &str) -> Result<(), AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    let salt_hex = get_meta(&db, META_SALT)?
        .ok_or_else(|| AppError::InvalidInput("vault not initialized".into()))?;
    let salt = hex::decode(&salt_hex).map_err(|_| AppError::Crypto("corrupt salt".into()))?;
    let verifier_hex = get_meta(&db, META_VERIFIER)?
        .ok_or_else(|| AppError::InvalidInput("verifier missing".into()))?;
    let verifier_ct =
        hex::decode(&verifier_hex).map_err(|_| AppError::Crypto("corrupt verifier".into()))?;
    let key = derive_key(password, &salt)?;
    open(&key, &verifier_ct).map_err(|_| AppError::InvalidInput("wrong password".into()))?;
    Ok(())
}

pub(crate) fn get_meta(db: &rusqlite::Connection, key: &str) -> Result<Option<String>, AppError> {
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

pub(crate) fn set_meta(db: &rusqlite::Connection, key: &str, value: &str) -> Result<(), AppError> {
    db.execute(
        "INSERT INTO meta(key, value) VALUES(?1,?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![key, value],
    )?;
    Ok(())
}
