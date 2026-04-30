use serde::{Deserialize, Serialize};
use tauri::State;
use zeroize::Zeroize;

use crate::{
    crypto::{open, seal},
    db::repo::{Account, AccountRepo, CreateAccount, UpdateAccount},
    error::AppError,
    state::AppState,
    totp::secret::{decode_base32_lenient, generate, normalize_secret},
};

/// What the frontend sees — no secret plaintext, only generated code + TTL.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithCode {
    pub id: i64,
    pub group_id: Option<i64>,
    pub name: String,
    pub issuer: Option<String>,
    pub algorithm: String,
    pub digits: u8,
    pub period: u32,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i64,
    pub code: String,
    pub ttl: u32,
    pub progress: f32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAccountInput {
    pub name: String,
    pub issuer: Option<String>,
    pub secret: String,
    pub algorithm: Option<String>,
    pub digits: Option<u8>,
    pub period: Option<u32>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub group_id: Option<i64>,
}

#[tauri::command]
pub fn get_accounts(state: State<'_, AppState>) -> Result<Vec<AccountWithCode>, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();
    let db = state.db.lock().expect("db lock poisoned");
    let repo = AccountRepo(&db);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    repo.list_with_cipher()?
        .into_iter()
        .map(|(acc, cipher)| {
            let mut secret_bytes = open(vault_key, &cipher)?;
            let period = acc.period;
            let code = generate(&secret_bytes, acc.algorithm.as_str(), acc.digits, period, 0);
            secret_bytes.zeroize();
            let ttl = period - (now % period as u64) as u32;
            let progress = ttl as f32 / period as f32;
            Ok(AccountWithCode {
                id: acc.id,
                group_id: acc.group_id,
                name: acc.name,
                issuer: acc.issuer,
                algorithm: acc.algorithm,
                digits: acc.digits,
                period,
                icon: acc.icon,
                color: acc.color,
                sort_order: acc.sort_order,
                code,
                ttl,
                progress,
            })
        })
        .collect()
}

#[tauri::command]
pub fn add_account(
    input: AddAccountInput,
    state: State<'_, AppState>,
) -> Result<AccountWithCode, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();
    let db = state.db.lock().expect("db lock poisoned");
    let repo = AccountRepo(&db);

    let algorithm = input
        .algorithm
        .as_deref()
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "SHA1".to_string());
    let digits = input.digits.unwrap_or(6);
    let period = input.period.unwrap_or(30);
    validate_totp_params(&algorithm, digits, period)?;
    let normalized = normalize_secret(&input.secret);
    let mut secret_bytes = decode_base32_lenient(&normalized)
        .map_err(|_| AppError::InvalidInput("invalid base32 secret".into()))?;

    let secret_cipher = seal(vault_key, &secret_bytes)?;

    let acc = repo.create(CreateAccount {
        name: input.name,
        issuer: input.issuer,
        secret_cipher,
        algorithm: Some(algorithm),
        digits: Some(digits),
        period: Some(period),
        icon: input.icon,
        color: input.color,
        group_id: input.group_id,
    })?;

    let out = get_account_with_code(&acc, &secret_bytes);
    secret_bytes.zeroize();
    out
}

fn validate_totp_params(algorithm: &str, digits: u8, period: u32) -> Result<(), AppError> {
    if !matches!(algorithm, "SHA1" | "SHA256" | "SHA512") {
        return Err(AppError::InvalidInput(format!(
            "unsupported algorithm: {algorithm}"
        )));
    }
    if !(6..=8).contains(&digits) {
        return Err(AppError::InvalidInput(
            "digits must be between 6 and 8".into(),
        ));
    }
    if !(15..=300).contains(&period) {
        return Err(AppError::InvalidInput(
            "period must be between 15 and 300".into(),
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn update_account(
    id: i64,
    input: UpdateAccount,
    state: State<'_, AppState>,
) -> Result<AccountWithCode, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();
    let db = state.db.lock().expect("db lock poisoned");
    let repo = AccountRepo(&db);
    let acc = repo.update(id, input)?;
    let cipher = repo.get_secret_cipher(acc.id)?;
    let mut secret_bytes = open(vault_key, &cipher)?;
    let result = get_account_with_code(&acc, &secret_bytes);
    secret_bytes.zeroize();
    result
}

#[tauri::command]
pub fn delete_account(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    if vault.is_none() {
        return Err(AppError::VaultLocked);
    }
    let db = state.db.lock().expect("db lock poisoned");
    AccountRepo(&db).delete(id)
}

#[tauri::command]
pub fn reorder_accounts(ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    if vault.is_none() {
        return Err(AppError::VaultLocked);
    }
    let db = state.db.lock().expect("db lock poisoned");
    AccountRepo(&db).reorder(&ids)
}

fn get_account_with_code(acc: &Account, secret_bytes: &[u8]) -> Result<AccountWithCode, AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let period = acc.period;
    if period == 0 {
        return Err(AppError::InvalidInput("period must be > 0".into()));
    }
    let code = generate(secret_bytes, acc.algorithm.as_str(), acc.digits, period, 0);
    let ttl = period - (now % period as u64) as u32;
    Ok(AccountWithCode {
        id: acc.id,
        group_id: acc.group_id,
        name: acc.name.clone(),
        issuer: acc.issuer.clone(),
        algorithm: acc.algorithm.clone(),
        digits: acc.digits,
        period,
        icon: acc.icon.clone(),
        color: acc.color.clone(),
        sort_order: acc.sort_order,
        code,
        ttl,
        progress: ttl as f32 / period as f32,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_totp_params_accepts_supported_values() {
        assert!(validate_totp_params("SHA1", 6, 30).is_ok());
        assert!(validate_totp_params("SHA256", 7, 45).is_ok());
        assert!(validate_totp_params("SHA512", 8, 300).is_ok());
    }

    #[test]
    fn validate_totp_params_rejects_unsupported_algorithm() {
        assert!(validate_totp_params("MD5", 6, 30).is_err());
    }

    #[test]
    fn validate_totp_params_rejects_digits_out_of_range() {
        assert!(validate_totp_params("SHA1", 5, 30).is_err());
        assert!(validate_totp_params("SHA1", 9, 30).is_err());
    }

    #[test]
    fn validate_totp_params_rejects_period_out_of_range() {
        assert!(validate_totp_params("SHA1", 6, 0).is_err());
        assert!(validate_totp_params("SHA1", 6, 301).is_err());
    }
}
