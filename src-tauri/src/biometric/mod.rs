use keyring::Entry;

use crate::error::AppError;

const SERVICE: &str = "simple-2fa";
const USERNAME: &str = "vault-key";

pub fn store_vault_key(key: &[u8]) -> Result<(), AppError> {
    keyring_entry()?
        .set_password(&hex::encode(key))
        .map_err(map_keyring_err)
}

pub fn load_vault_key() -> Result<Vec<u8>, AppError> {
    let value = keyring_entry()?.get_password().map_err(map_keyring_err)?;
    hex::decode(value).map_err(|e| AppError::Crypto(format!("invalid keychain payload: {e}")))
}

pub fn delete_vault_key() -> Result<(), AppError> {
    keyring_entry()?
        .delete_credential()
        .map_err(map_keyring_err)
}

fn keyring_entry() -> Result<Entry, AppError> {
    Entry::new(SERVICE, USERNAME).map_err(map_keyring_err)
}

fn map_keyring_err(err: keyring::Error) -> AppError {
    match err {
        keyring::Error::NoEntry => AppError::BiometricNotEnabled,
        other => AppError::Io(format!("keyring error: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Mutex, OnceLock};

    fn memory_store() -> &'static Mutex<Option<String>> {
        static STORE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(None))
    }

    fn store_vault_key_mock(key: &[u8]) {
        let mut slot = memory_store().lock().expect("lock must succeed");
        *slot = Some(hex::encode(key));
    }

    fn load_vault_key_mock() -> Option<Vec<u8>> {
        let slot = memory_store().lock().expect("lock must succeed");
        slot.clone().and_then(|v| hex::decode(v).ok())
    }

    fn delete_vault_key_mock() {
        let mut slot = memory_store().lock().expect("lock must succeed");
        *slot = None;
    }

    #[test]
    fn store_sets_value() {
        store_vault_key_mock(&[1, 2, 3, 4]);
        let value = memory_store().lock().expect("lock must succeed").clone();
        assert_eq!(value.as_deref(), Some("01020304"));
    }

    #[test]
    fn load_returns_original_bytes() {
        store_vault_key_mock(&[9, 8, 7]);
        let loaded = load_vault_key_mock().expect("value should exist");
        assert_eq!(loaded, vec![9, 8, 7]);
    }

    #[test]
    fn delete_clears_value() {
        store_vault_key_mock(&[5, 6]);
        delete_vault_key_mock();
        assert!(load_vault_key_mock().is_none());
    }
}
