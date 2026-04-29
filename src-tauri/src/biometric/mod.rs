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
    use std::sync::Mutex;

    struct MemStore(Mutex<Option<String>>);

    impl MemStore {
        fn new() -> Self {
            Self(Mutex::new(None))
        }
        fn store(&self, key: &[u8]) {
            *self.0.lock().unwrap() = Some(hex::encode(key));
        }
        fn load(&self) -> Option<Vec<u8>> {
            self.0
                .lock()
                .unwrap()
                .clone()
                .and_then(|v| hex::decode(v).ok())
        }
        fn delete(&self) {
            *self.0.lock().unwrap() = None;
        }
    }

    #[test]
    fn store_sets_value() {
        let s = MemStore::new();
        s.store(&[1, 2, 3, 4]);
        assert_eq!(s.0.lock().unwrap().as_deref(), Some("01020304"));
    }

    #[test]
    fn load_returns_original_bytes() {
        let s = MemStore::new();
        s.store(&[9, 8, 7]);
        assert_eq!(s.load().unwrap(), vec![9, 8, 7]);
    }

    #[test]
    fn delete_clears_value() {
        let s = MemStore::new();
        s.store(&[5, 6]);
        s.delete();
        assert!(s.load().is_none());
    }
}
