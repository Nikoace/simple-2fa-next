use serde::Serialize;

use crate::{
    crypto::legacy_s2fa::{ExportAccountV1, decrypt_v1},
    error::AppError,
    totp::secret::{decode_base32_lenient, normalize_secret},
};

/// Import pipeline item with decoded raw secret bytes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAccountItem {
    pub name: String,
    pub issuer: Option<String>,
    #[serde(skip)]
    pub secret_bytes: Vec<u8>,
    pub algorithm: String,
    pub digits: u8,
    pub period: u32,
}

#[derive(Debug, Serialize)]
pub struct ImportPreview {
    pub items: Vec<ImportAccountItem>,
    pub format: String,
}

/// Parses .s2fa bytes and dispatches to v1/v2 pipeline.
pub fn import_s2fa(data: &[u8], password: &str) -> Result<ImportPreview, AppError> {
    let is_v2 = data.len() > 8 && data[8] == 0x02;

    if is_v2 {
        import_v2(data, password)
    } else {
        import_v1(data, password)
    }
}

fn import_v1(data: &[u8], password: &str) -> Result<ImportPreview, AppError> {
    let accounts = decrypt_v1(data, password)?;
    let items = accounts
        .into_iter()
        .map(convert_v1_account)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ImportPreview {
        items,
        format: "v1".into(),
    })
}

fn convert_v1_account(a: ExportAccountV1) -> Result<ImportAccountItem, AppError> {
    let normalized = normalize_secret(&a.secret);
    let secret_bytes = decode_base32_lenient(&normalized)?;
    Ok(ImportAccountItem {
        name: a.name,
        issuer: a.issuer,
        secret_bytes,
        algorithm: "SHA1".into(),
        digits: 6,
        period: 30,
    })
}

fn import_v2(data: &[u8], _password: &str) -> Result<ImportPreview, AppError> {
    let _ = data;
    Err(AppError::Import("v2 format not yet supported".into()))
}

#[cfg(test)]
mod tests {
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce,
    };
    use argon2::{Argon2, Params, Version};

    use super::*;

    fn make_v1_fixture(accounts: &[ExportAccountV1], password: &str) -> Vec<u8> {
        let salt: [u8; 16] = *b"s2fa_test_salt!!";
        let nonce_b: [u8; 12] = *b"s2fa_nonce!!";
        let params = Params::new(65_536, 3, 4, Some(32)).expect("argon2 params must be valid");
        let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
        let mut key = [0u8; 32];
        argon2
            .hash_password_into(password.as_bytes(), &salt, &mut key)
            .expect("kdf must succeed");
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

    #[test]
    fn import_v1_produces_correct_items() {
        let accounts = vec![ExportAccountV1 {
            name: "alice".into(),
            issuer: Some("GH".into()),
            secret: "JBSWY3DPEHPK3PXP".into(),
        }];
        let data = make_v1_fixture(&accounts, "pw");
        let preview = import_s2fa(&data, "pw").expect("import must succeed");
        assert_eq!(preview.format, "v1");
        assert_eq!(preview.items.len(), 1);
        assert_eq!(preview.items[0].name, "alice");
        assert_eq!(preview.items[0].algorithm, "SHA1");
        assert_eq!(preview.items[0].digits, 6);
        assert_eq!(preview.items[0].period, 30);
        assert!(!preview.items[0].secret_bytes.is_empty());
    }

    #[test]
    fn import_v1_wrong_password_errors() {
        let accounts = vec![ExportAccountV1 {
            name: "x".into(),
            issuer: None,
            secret: "JBSWY3DP".into(),
        }];
        let data = make_v1_fixture(&accounts, "correct");
        assert!(import_s2fa(&data, "wrong").is_err());
    }

    #[test]
    fn version_dispatch_v2_prefix_returns_error() {
        let mut data = b"S2FA_ENC".to_vec();
        data.push(0x02);
        data.extend_from_slice(&[0u8; 50]);
        assert!(import_s2fa(&data, "pw").is_err());
    }
}
