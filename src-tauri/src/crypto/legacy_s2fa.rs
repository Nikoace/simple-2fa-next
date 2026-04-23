use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, Params, Version};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

const MAGIC: &[u8; 8] = b"S2FA_ENC";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportAccountV1 {
    pub name: String,
    pub issuer: Option<String>,
    pub secret: String,
}

/// Decrypts v1 format .s2fa backups.
/// Format: [8B magic][16B salt][12B nonce][ciphertext+tag]
pub fn decrypt_v1(data: &[u8], password: &str) -> Result<Vec<ExportAccountV1>, AppError> {
    const MIN_LEN: usize = 8 + 16 + 12 + 1;
    if data.len() < MIN_LEN {
        return Err(AppError::Import("file too short".into()));
    }
    if &data[..8] != MAGIC {
        return Err(AppError::Import("invalid magic bytes".into()));
    }

    let salt = &data[8..24];
    let nonce_b = &data[24..36];
    let ct = &data[36..];

    let key = derive_v1_key(password, salt)?;

    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|_| AppError::Crypto("aes init failed".into()))?;
    let nonce = Nonce::from_slice(nonce_b);
    let pt = cipher
        .decrypt(nonce, ct)
        .map_err(|_| AppError::Import("wrong password or corrupted file".into()))?;

    serde_json::from_slice::<Vec<ExportAccountV1>>(&pt)
        .map_err(|_| AppError::Import("wrong password or corrupted file".into()))
}

/// Argon2id KDF for v1 format. FROZEN — do not sync with `crypto::kdf::derive_key`.
fn derive_v1_key(password: &str, salt: &[u8]) -> Result<[u8; 32], AppError> {
    let params =
        Params::new(65_536, 3, 4, Some(32)).map_err(|_| AppError::Crypto("argon2 params".into()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| AppError::Crypto("kdf failed".into()))?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_v1(accounts: &[ExportAccountV1], password: &str) -> Vec<u8> {
        use aes_gcm::aead::KeyInit;

        let salt: [u8; 16] = *b"s2fa_test_salt!!";
        let nonce_b: [u8; 12] = *b"s2fa_nonce!!";
        let key = derive_v1_key(password, &salt).expect("kdf must succeed");
        let pt = serde_json::to_vec(accounts).expect("json encode must succeed");
        let cipher = Aes256Gcm::new_from_slice(&key).expect("aes init must succeed");
        let nonce = Nonce::from_slice(&nonce_b);
        let ct = cipher.encrypt(nonce, pt.as_ref()).expect("encrypt must succeed");
        let mut out = b"S2FA_ENC".to_vec();
        out.extend_from_slice(&salt);
        out.extend_from_slice(&nonce_b);
        out.extend_from_slice(&ct);
        out
    }

    fn sample() -> Vec<ExportAccountV1> {
        vec![
            ExportAccountV1 {
                name: "a".into(),
                issuer: Some("X".into()),
                secret: "JBSWY3DPEHPK3PXP".into(),
            },
            ExportAccountV1 {
                name: "b".into(),
                issuer: None,
                secret: "GEZDGNBVGY3TQOJQ".into(),
            },
        ]
    }

    #[test]
    fn roundtrip() {
        let data = make_v1(&sample(), "pw");
        let out = decrypt_v1(&data, "pw").expect("decrypt must succeed");
        assert_eq!(out, sample());
    }

    #[test]
    fn wrong_password_errors() {
        let data = make_v1(&sample(), "pw");
        assert!(decrypt_v1(&data, "bad").is_err());
    }

    #[test]
    fn invalid_magic_errors() {
        let mut data = make_v1(&sample(), "pw");
        data[0] = 0xFF;
        assert!(decrypt_v1(&data, "pw").is_err());
    }

    #[test]
    fn too_short_errors() {
        assert!(decrypt_v1(&[0u8; 10], "pw").is_err());
    }

    #[test]
    fn null_issuer_preserved() {
        let accounts = vec![ExportAccountV1 {
            name: "x".into(),
            issuer: None,
            secret: "JBSWY3DP".into(),
        }];
        let data = make_v1(&accounts, "pw");
        let out = decrypt_v1(&data, "pw").expect("decrypt must succeed");
        assert!(out[0].issuer.is_none());
    }
}
