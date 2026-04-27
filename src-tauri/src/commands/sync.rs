use chrono::{DateTime, Utc};
use data_encoding::BASE32_NOPAD;
use secrecy::ExposeSecret;
use tauri::{Emitter, State};
use zeroize::Zeroize;

use crate::{
    crypto::{open, seal},
    db::repo::{AccountRepo, CreateAccount},
    error::AppError,
    importer::{export::export_s2fa, export::ExportAccount, import_s2fa},
    state::AppState,
    sync::{sync_vault, SyncConfig, SyncStatus},
};

use super::vault::{get_meta, set_meta};
use crate::sync::s3::S3Provider;
use crate::sync::webdav::WebDavProvider;

const META_SYNC_CONFIG: &str = "sync_config";
const REMOTE_FILE: &str = "vault.s2fa";

#[tauri::command]
pub fn configure_sync(config: SyncConfig, state: State<'_, AppState>) -> Result<(), AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();

    let raw = serde_json::to_vec(&config).map_err(|e| AppError::Sync(e.to_string()))?;
    let encrypted = seal(vault_key, &raw)?;
    let encoded = hex::encode(encrypted);

    let db = state.db.lock().expect("db lock poisoned");
    set_meta(&db, META_SYNC_CONFIG, &encoded)
}

#[tauri::command]
pub async fn sync_now(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncStatus, AppError> {
    {
        let mut status = state.sync_status.lock().expect("sync status lock poisoned");
        status.in_progress = true;
        status.last_error = None;
        app.emit("sync://status-changed", &*status)
            .map_err(|e| AppError::Sync(e.to_string()))?;
    }

    let sync_result = sync_now_inner(&state).await;

    let mut status = state.sync_status.lock().expect("sync status lock poisoned");
    status.in_progress = false;

    match sync_result {
        Ok(()) => {
            status.last_sync = Some(Utc::now());
            status.last_error = None;
        }
        Err(err) => {
            status.last_error = Some(err.to_string());
        }
    }

    let out = status.clone();
    app.emit("sync://status-changed", &out)
        .map_err(|e| AppError::Sync(e.to_string()))?;

    if let Some(msg) = &status.last_error {
        return Err(AppError::Sync(msg.clone()));
    }

    Ok(out)
}

#[tauri::command]
pub fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatus, AppError> {
    Ok(state
        .sync_status
        .lock()
        .expect("sync status lock poisoned")
        .clone())
}

#[tauri::command]
pub fn disable_sync(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    {
        let db = state.db.lock().expect("db lock poisoned");
        db.execute(
            "DELETE FROM meta WHERE key = ?1",
            rusqlite::params![META_SYNC_CONFIG],
        )?;
    }

    let reset = SyncStatus {
        last_sync: None,
        last_error: None,
        in_progress: false,
    };
    *state.sync_status.lock().expect("sync status lock poisoned") = reset.clone();
    app.emit("sync://status-changed", &reset)
        .map_err(|e| AppError::Sync(e.to_string()))?;
    Ok(())
}

async fn sync_now_inner(state: &AppState) -> Result<(), AppError> {
    let config = load_sync_config(state)?;
    let local_last_modified = get_local_last_modified(state)?;

    match config {
        SyncConfig::WebDav {
            url,
            username,
            password,
            remote_path,
        } => {
            let provider = WebDavProvider::new(url, username, password);
            sync_vault(
                &provider,
                &remote_path,
                local_last_modified,
                || export_local_vault(state),
                |bytes| import_remote_vault(state, &bytes),
            )
            .await?;
            Ok(())
        }
        SyncConfig::S3 {
            bucket,
            prefix,
            region,
            access_key,
            secret_key,
        } => {
            let provider = S3Provider::new(bucket, prefix, region, access_key, secret_key)?;
            sync_vault(
                &provider,
                REMOTE_FILE,
                local_last_modified,
                || export_local_vault(state),
                |bytes| import_remote_vault(state, &bytes),
            )
            .await?;
            Ok(())
        }
    }
}

fn load_sync_config(state: &AppState) -> Result<SyncConfig, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_key = vault.as_ref().ok_or(AppError::VaultLocked)?.key_bytes();

    let db = state.db.lock().expect("db lock poisoned");
    let encoded = get_meta(&db, META_SYNC_CONFIG)?
        .ok_or_else(|| AppError::InvalidInput("sync not configured".into()))?;

    let bytes = hex::decode(encoded).map_err(|e| AppError::Sync(e.to_string()))?;
    let plaintext = open(vault_key, &bytes)?;
    serde_json::from_slice(&plaintext).map_err(|e| AppError::Sync(e.to_string()))
}

fn export_local_vault(state: &AppState) -> Result<Vec<u8>, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_state = vault.as_ref().ok_or(AppError::VaultLocked)?;
    let vault_key = vault_state.key_bytes();
    let export_password = vault_state.master_password.expose_secret();
    if export_password.is_empty() {
        return Err(AppError::InvalidInput(
            "sync requires password unlock in current session".into(),
        ));
    }

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

    export_s2fa(&export_accounts, export_password)
}

fn import_remote_vault(state: &AppState, bytes: &[u8]) -> Result<(), AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    let vault_state = vault.as_ref().ok_or(AppError::VaultLocked)?;
    let vault_key = vault_state.key_bytes();
    let password = vault_state.master_password.expose_secret();
    if password.is_empty() {
        return Err(AppError::InvalidInput(
            "sync requires password unlock in current session".into(),
        ));
    }

    let preview = import_s2fa(bytes, password)?;

    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction()?;
    tx.execute("DELETE FROM accounts", [])?;

    let repo = AccountRepo(&tx);
    for item in preview.items {
        let mut secret_bytes = crate::totp::secret::decode_base32_lenient(&item.secret)
            .map_err(|_| AppError::InvalidInput("invalid base32 secret".into()))?;
        let secret_cipher = seal(vault_key, &secret_bytes)?;
        secret_bytes.zeroize();

        repo.create(CreateAccount {
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
    }

    tx.commit()?;
    Ok(())
}

fn get_local_last_modified(state: &AppState) -> Result<Option<DateTime<Utc>>, AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    let last: Option<i64> =
        db.query_row("SELECT MAX(updated_at) FROM accounts", [], |r| r.get(0))?;

    Ok(last.and_then(DateTime::<Utc>::from_timestamp_millis))
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use secrecy::Secret;

    use crate::{
        crypto::derive_key,
        db::migrate::run_migrations,
        state::{AppState, VaultState},
        sync::SyncConfig,
    };

    use super::{load_sync_config, META_SYNC_CONFIG};

    fn make_state_with_password(password: &str) -> AppState {
        let mut conn = Connection::open_in_memory().expect("in-memory db");
        run_migrations(&mut conn).expect("migrations");

        let salt = [0u8; 16];
        let key = derive_key(password, &salt).expect("derive key");

        let state = AppState::new(conn);
        *state.vault.lock().expect("vault") = Some(VaultState {
            key: Secret::new(key),
            master_password: Secret::new(password.to_owned()),
        });
        state
    }

    #[test]
    fn get_local_last_modified_returns_none_for_empty_db() {
        let state = make_state_with_password("pw");
        let result = super::get_local_last_modified(&state).expect("should succeed");
        assert!(result.is_none());
    }

    #[test]
    fn load_sync_config_errors_when_not_configured() {
        let state = make_state_with_password("pw");
        let err = load_sync_config(&state).expect_err("should fail without config");
        assert!(err.to_string().contains("sync not configured"));
    }

    #[test]
    fn configure_and_load_webdav_config_roundtrip() {
        let state = make_state_with_password("pw");
        let vault = state.vault.lock().expect("vault");
        let vault_key = vault.as_ref().unwrap().key_bytes();

        let config = SyncConfig::WebDav {
            url: "https://dav.example.com".into(),
            username: "alice".into(),
            password: "secret".into(),
            remote_path: "vault.s2fa".into(),
        };

        let raw = serde_json::to_vec(&config).expect("serialize");
        let encrypted = crate::crypto::seal(vault_key, &raw).expect("seal");
        let encoded = hex::encode(encrypted);
        drop(vault);

        {
            let db = state.db.lock().expect("db");
            super::set_meta(&db, META_SYNC_CONFIG, &encoded).expect("set_meta");
        }

        let loaded = load_sync_config(&state).expect("load");
        match loaded {
            SyncConfig::WebDav {
                url,
                username,
                remote_path,
                ..
            } => {
                assert_eq!(url, "https://dav.example.com");
                assert_eq!(username, "alice");
                assert_eq!(remote_path, "vault.s2fa");
            }
            _ => panic!("expected WebDav"),
        }
    }

    #[test]
    fn sync_config_serializes_fields_as_camel_case() {
        let config = SyncConfig::WebDav {
            url: "u".into(),
            username: "u".into(),
            password: "p".into(),
            remote_path: "r".into(),
        };
        let json = serde_json::to_value(&config).expect("serialize");
        assert!(
            json.get("remotePath").is_some(),
            "remotePath key must be present"
        );
        assert!(
            json.get("remote_path").is_none(),
            "snake_case key must not appear"
        );

        let config = SyncConfig::S3 {
            bucket: "b".into(),
            prefix: "p".into(),
            region: "r".into(),
            access_key: "ak".into(),
            secret_key: "sk".into(),
        };
        let json = serde_json::to_value(&config).expect("serialize");
        assert!(
            json.get("accessKey").is_some(),
            "accessKey key must be present"
        );
        assert!(
            json.get("secretKey").is_some(),
            "secretKey key must be present"
        );
        assert!(
            json.get("access_key").is_none(),
            "snake_case key must not appear"
        );
    }

    #[test]
    fn sync_config_deserializes_camel_case_fields() {
        let json = r#"{"type":"WebDav","url":"u","username":"u","password":"p","remotePath":"r"}"#;
        let config: SyncConfig = serde_json::from_str(json).expect("deserialize");
        match config {
            SyncConfig::WebDav { remote_path, .. } => assert_eq!(remote_path, "r"),
            _ => panic!("expected WebDav"),
        }

        let json = r#"{"type":"S3","bucket":"b","prefix":"p","region":"r","accessKey":"ak","secretKey":"sk"}"#;
        let config: SyncConfig = serde_json::from_str(json).expect("deserialize");
        match config {
            SyncConfig::S3 {
                access_key,
                secret_key,
                ..
            } => {
                assert_eq!(access_key, "ak");
                assert_eq!(secret_key, "sk");
            }
            _ => panic!("expected S3"),
        }
    }
}
