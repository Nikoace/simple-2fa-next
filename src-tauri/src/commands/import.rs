use std::collections::HashSet;

use data_encoding::BASE32_NOPAD;
use tauri::State;
use zeroize::Zeroize;

use crate::{
    commands::accounts::AccountWithCode,
    crypto::{open, seal},
    db::repo::{Account, AccountRepo, CreateAccount},
    error::AppError,
    importer::{
        ImportAccountItem, ImportPreview, export::ExportAccount, export::export_s2fa,
        import_s2fa, parse_otpauth_uri,
    },
    state::AppState,
    totp::secret::{decode_base32_lenient, generate},
};

#[tauri::command]
pub fn import_s2fa_file(path: String, password: String) -> Result<ImportPreview, AppError> {
    let data = std::fs::read(path)?;
    import_s2fa(&data, &password)
}

#[tauri::command]
pub fn parse_otpauth_uri_cmd(uri: String) -> Result<ImportAccountItem, AppError> {
    parse_otpauth_uri(&uri)
}

#[tauri::command]
pub fn commit_import(
    items: Vec<ImportAccountItem>,
    state: State<'_, AppState>,
) -> Result<Vec<AccountWithCode>, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();

    let db = state.db.lock().expect("db lock poisoned");
    let repo = AccountRepo(&db);

    let existing = repo.list_with_cipher()?;
    let mut seen = HashSet::new();
    for (acc, _) in existing {
        seen.insert(account_key(&acc.name, acc.issuer.as_deref()));
    }

    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let key = account_key(&item.name, item.issuer.as_deref());
        if seen.contains(&key) {
            return Err(AppError::InvalidInput(format!(
                "duplicate account: {}",
                item.name
            )));
        }

        let mut secret_bytes = decode_base32_lenient(&item.secret)
            .map_err(|_| AppError::InvalidInput("invalid base32 secret".into()))?;
        let secret_cipher = seal(vault_key, &secret_bytes)?;

        let acc = repo.create(CreateAccount {
            name: item.name,
            issuer: item.issuer,
            secret_cipher,
            algorithm: Some(item.algorithm),
            digits: Some(item.digits),
            period: Some(item.period),
            icon: None,
            color: None,
            group_id: None,
        })?;

        let account_with_code = to_account_with_code(&acc, &secret_bytes)?;
        secret_bytes.zeroize();
        out.push(account_with_code);
        seen.insert(key);
    }

    Ok(out)
}

#[tauri::command]
pub fn export_vault_to_file(
    path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();

    let db = state.db.lock().expect("db lock poisoned");
    let repo = AccountRepo(&db);

    let rows = repo.list_with_cipher()?;
    let mut export_accounts = Vec::with_capacity(rows.len());
    for (acc, cipher) in rows {
        let mut secret_bytes = open(vault_key, &cipher)?;
        let secret_plaintext = BASE32_NOPAD.encode(&secret_bytes);
        secret_bytes.zeroize();

        export_accounts.push(ExportAccount {
            name: acc.name,
            issuer: acc.issuer,
            secret_plaintext,
            algorithm: acc.algorithm,
            digits: acc.digits,
            period: acc.period,
        });
    }

    let encoded = export_s2fa(&export_accounts, &password)?;
    std::fs::write(path, encoded)?;
    Ok(())
}

fn account_key(name: &str, issuer: Option<&str>) -> String {
    format!("{}::{}", issuer.unwrap_or_default().trim(), name.trim())
}

fn to_account_with_code(acc: &Account, secret_bytes: &[u8]) -> Result<AccountWithCode, AppError> {
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
