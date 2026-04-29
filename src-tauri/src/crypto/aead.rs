use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

use crate::error::AppError;

const NONCE_LEN: usize = 12;

/// Encrypts `plaintext` with AES-256-GCM. Output: [12B nonce || ciphertext || 16B tag].
pub fn seal(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, AppError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Crypto(e.to_string()))?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let mut ct = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::Crypto(e.to_string()))?;
    let mut out = Vec::with_capacity(NONCE_LEN + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.append(&mut ct);
    Ok(out)
}

/// Decrypts a blob produced by `seal`.
pub fn open(key: &[u8; 32], blob: &[u8]) -> Result<Vec<u8>, AppError> {
    if blob.len() <= NONCE_LEN {
        return Err(AppError::Crypto("blob too short".into()));
    }
    let (nonce_bytes, ct) = blob.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Crypto(e.to_string()))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| AppError::Crypto("decryption failed".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> [u8; 32] {
        [0u8; 32]
    }

    #[test]
    fn roundtrip() {
        let ct = seal(&key(), b"hello world").expect("encryption must succeed");
        let pt = open(&key(), &ct).expect("decryption must succeed");
        assert_eq!(pt, b"hello world");
    }

    #[test]
    fn wrong_key_fails() {
        let ct = seal(&key(), b"secret").expect("encryption must succeed");
        let mut bad_key = key();
        bad_key[0] = 1;
        assert!(open(&bad_key, &ct).is_err());
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let mut ct = seal(&key(), b"data").expect("encryption must succeed");
        let last = ct.len() - 1;
        ct[last] ^= 0xFF;
        assert!(open(&key(), &ct).is_err());
    }

    #[test]
    fn output_format_is_nonce_plus_ciphertext() {
        let ct = seal(&key(), b"x").expect("encryption must succeed");
        assert!(ct.len() >= 29);
    }

    #[test]
    fn two_seals_of_same_plaintext_differ() {
        let ct1 = seal(&key(), b"same").expect("encryption must succeed");
        let ct2 = seal(&key(), b"same").expect("encryption must succeed");
        assert_ne!(ct1, ct2);
    }
}
