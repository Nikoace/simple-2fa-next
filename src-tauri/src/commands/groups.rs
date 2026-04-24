use tauri::State;

use crate::{
    db::repo::{Group, GroupRepo},
    error::AppError,
    state::AppState,
};

#[tauri::command]
pub fn list_groups(state: State<'_, AppState>) -> Result<Vec<Group>, AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).list()
}

#[tauri::command]
pub fn create_group(name: String, state: State<'_, AppState>) -> Result<Group, AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).create(&name)
}

#[tauri::command]
pub fn rename_group(
    id: i64,
    name: String,
    state: State<'_, AppState>,
) -> Result<Group, AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).rename(id, &name)
}

#[tauri::command]
pub fn delete_group(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).delete(id)
}
