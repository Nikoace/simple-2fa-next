use argon2::{Argon2, Params, Version};

use crate::error::AppError;

/// Derives a 256-bit vault key from a master password using Argon2id.
/// These parameters happen to match the v1 .s2fa export format; see
/// `crypto::legacy_s2fa::derive_v1_key` for the frozen v1 path — do not
/// keep these two in sync. Vault KDF parameters may be strengthened independently.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_output() {
        let k1 = derive_key("password", b"0123456789abcdef").expect("kdf must succeed");
        let k2 = derive_key("password", b"0123456789abcdef").expect("kdf must succeed");
        assert_eq!(k1, k2);
    }

    #[test]
    fn different_password_different_key() {
        let k1 = derive_key("pass1", b"0123456789abcdef").expect("kdf must succeed");
        let k2 = derive_key("pass2", b"0123456789abcdef").expect("kdf must succeed");
        assert_ne!(k1, k2);
    }

    #[test]
    fn different_salt_different_key() {
        let k1 = derive_key("pass", b"0000000000000000").expect("kdf must succeed");
        let k2 = derive_key("pass", b"1111111111111111").expect("kdf must succeed");
        assert_ne!(k1, k2);
    }

    #[test]
    fn output_is_32_bytes() {
        let k = derive_key("any", b"0123456789abcdef").expect("kdf must succeed");
        assert_eq!(k.len(), 32);
    }
}
