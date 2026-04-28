use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};

use crate::{crypto::derive_key, error::AppError};

const MAGIC_V2: &[u8; 8] = b"S2FA_V2\0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportAccount {
    pub name: String,
    pub issuer: Option<String>,
    pub secret_plaintext: String,
    pub algorithm: String,
    pub digits: u8,
    pub period: u32,
}

pub fn export_s2fa(accounts: &[ExportAccount], password: &str) -> Result<Vec<u8>, AppError> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| AppError::Crypto(e.to_string()))?;
    let plaintext = serde_json::to_vec(accounts).map_err(|e| AppError::Import(e.to_string()))?;
    let nonce_ref = Nonce::from_slice(&nonce);
    let ciphertext = cipher
        .encrypt(nonce_ref, plaintext.as_ref())
        .map_err(|_| AppError::Import("failed to encrypt export".into()))?;

    let mut out = Vec::with_capacity(8 + 16 + 12 + ciphertext.len());
    out.extend_from_slice(MAGIC_V2);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}
