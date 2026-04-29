mod biometric;
mod commands;
pub mod crypto;
mod db;
mod error;
pub mod importer;
mod state;
pub mod sync;
pub mod totp;

use db::migrate::run_migrations;
use std::path::PathBuf;
use tauri::Manager;

pub use error::AppError;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_dir: PathBuf = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("accounts.db");

            let mut conn = rusqlite::Connection::open(&db_path).expect("failed to open database");
            conn.execute_batch("PRAGMA journal_mode=WAL")
                .expect("failed to set WAL mode");
            conn.execute_batch("PRAGMA foreign_keys = ON")
                .expect("failed to enable foreign keys");
            run_migrations(&mut conn).expect("migration failed");

            app.manage(AppState::new(conn));
            Ok(())
        });

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_biometric::init());

    builder
        .invoke_handler(tauri::generate_handler![
            commands::vault::setup_vault,
            commands::vault::unlock_vault,
            commands::vault::lock_vault,
            commands::vault::is_vault_initialized,
            commands::biometric::biometric_available,
            commands::biometric::enable_biometric,
            commands::biometric::unlock_with_biometric,
            commands::biometric::disable_biometric,
            commands::accounts::get_accounts,
            commands::accounts::add_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            commands::accounts::reorder_accounts,
            commands::groups::list_groups,
            commands::groups::create_group,
            commands::groups::rename_group,
            commands::groups::delete_group,
            commands::import::import_s2fa_file,
            commands::import::commit_import,
            commands::import::parse_otpauth_uri_cmd,
            commands::import::export_vault_to_file,
            commands::sync::configure_sync,
            commands::sync::sync_now,
            commands::sync::get_sync_status,
            commands::sync::disable_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
