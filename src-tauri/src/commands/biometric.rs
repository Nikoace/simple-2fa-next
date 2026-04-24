use secrecy::Secret;
use tauri::State;

use crate::{
    biometric::{delete_vault_key, load_vault_key, store_vault_key},
    error::AppError,
    state::{AppState, VaultState},
};

use super::vault::verify_password;

#[tauri::command]
pub fn biometric_available() -> Result<bool, AppError> {
    Ok(cfg!(mobile))
}

#[tauri::command]
pub fn enable_biometric(password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let key = {
        let vault = state.vault.lock().expect("vault lock poisoned");
        let Some(vault_state) = vault.as_ref() else {
            return Err(AppError::VaultLocked);
        };
        vault_state.key_bytes().to_vec()
    };

    verify_password(&state, &password)?;
    store_vault_key(&key)?;
    Ok(())
}

#[tauri::command]
pub fn unlock_with_biometric(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    trigger_biometric_auth(&app)?;

    let key = load_vault_key()?;
    if key.len() != 32 {
        return Err(AppError::Crypto("invalid stored vault key length".into()));
    }
    let mut fixed = [0u8; 32];
    fixed.copy_from_slice(&key);
    *state.vault.lock().expect("vault lock poisoned") = Some(VaultState {
        key: Secret::new(fixed),
        master_password: Secret::new(String::new()),
    });
    Ok(())
}

#[tauri::command]
pub fn disable_biometric() -> Result<(), AppError> {
    match delete_vault_key() {
        Ok(()) | Err(AppError::BiometricNotEnabled) => Ok(()),
        Err(e) => Err(e),
    }
}

#[cfg(not(mobile))]
fn trigger_biometric_auth(_app: &tauri::AppHandle) -> Result<(), AppError> {
    // On desktop the OS keyring is the authentication factor.
    Ok(())
}

#[cfg(mobile)]
fn trigger_biometric_auth(app: &tauri::AppHandle) -> Result<(), AppError> {
    use tauri_plugin_biometric::{AuthOptions, BiometricExt};
    app.biometric()
        .authenticate("Unlock vault".into(), AuthOptions::default())
        .map_err(|e| AppError::Crypto(format!("biometric: {e}")))
}
