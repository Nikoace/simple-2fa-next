mod commands;
pub mod crypto;
mod db;
mod error;
pub mod importer;
mod state;
pub mod totp;

use db::migrate::run_migrations;
use std::path::PathBuf;
use tauri::Manager;

pub use error::AppError;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_dir: PathBuf = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("accounts.db");

            let mut conn =
                rusqlite::Connection::open(&db_path).expect("failed to open database");
            run_migrations(&mut conn).expect("migration failed");

            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::vault::setup_vault,
            commands::vault::unlock_vault,
            commands::vault::lock_vault,
            commands::vault::is_vault_initialized,
            commands::accounts::get_accounts,
            commands::accounts::add_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            commands::accounts::reorder_accounts,
            commands::import::import_s2fa_file,
            commands::import::commit_import,
            commands::import::parse_otpauth_uri_cmd,
            commands::import::export_vault_to_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
