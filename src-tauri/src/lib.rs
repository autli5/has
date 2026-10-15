mod admin;
mod auth;
mod storage;

use admin::DeviceSecurityInfo;
use auth::{AuthResponse, DbStatus, ResetRequestResponse};
use serde::Serialize;
use storage::{ServerUserDto, StorageItemDto, StorageStats};

#[derive(Debug, Serialize)]
pub struct SafeDbInfo {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub dbname: String,
    pub ssl_mode: String,
    pub users_table: String,
    pub email_column: String,
}

#[tauri::command]
async fn check_db() -> Result<DbStatus, String> {
    Ok(auth::check_db_health().await)
}

#[tauri::command]
async fn login(email: String, password: String) -> Result<AuthResponse, String> {
    Ok(auth::authenticate_user(&email, &password).await)
}

#[tauri::command]
async fn register(email: String, password: String, username: Option<String>) -> Result<AuthResponse, String> {
    Ok(auth::register_user(&email, &password, username.as_deref()).await)
}

#[tauri::command]
async fn request_reset_code(email: String) -> Result<ResetRequestResponse, String> {
    Ok(auth::request_reset_code(&email).await)
}

#[tauri::command]
fn verify_reset_code(email: String, code: String) -> Result<AuthResponse, String> {
    Ok(auth::verify_reset_code(&email, &code))
}

#[tauri::command]
async fn reset_password(email: String, code: String, new_password: String) -> Result<AuthResponse, String> {
    Ok(auth::reset_password_with_code(&email, &code, &new_password).await)
}

#[tauri::command]
fn get_db_info() -> SafeDbInfo {
    let cfg = auth::get_db_config();
    SafeDbInfo {
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        dbname: cfg.dbname,
        ssl_mode: cfg.ssl_mode,
        users_table: cfg.users_table,
        email_column: cfg.email_column,
    }
}

// Storage commands
#[tauri::command]
async fn get_storage_stats() -> Result<StorageStats, String> {
    storage::get_server_storage_stats().await
}

#[tauri::command]
async fn list_storage_items(user_email: String) -> Result<Vec<StorageItemDto>, String> {
    storage::list_server_items(&user_email).await
}

#[tauri::command]
async fn create_server_folder(user_email: String, folder_name: String) -> Result<StorageItemDto, String> {
    storage::create_server_folder(&user_email, &folder_name).await
}

#[tauri::command]
async fn delete_server_item(user_email: String, item_id: String) -> Result<bool, String> {
    storage::delete_server_item(&user_email, &item_id).await
}

#[tauri::command]
async fn rename_server_item(user_email: String, item_id: String, new_name: String) -> Result<bool, String> {
    storage::rename_server_item(&user_email, &item_id, &new_name).await
}

#[tauri::command]
async fn upload_server_file(
    user_email: String,
    file_name: String,
    size_bytes: i64,
    mime_type: Option<String>,
    content_base64: Option<String>,
) -> Result<StorageItemDto, String> {
    storage::upload_server_file(&user_email, &file_name, size_bytes, mime_type, content_base64).await
}

#[tauri::command]
async fn list_server_users() -> Result<Vec<ServerUserDto>, String> {
    storage::list_server_users().await
}

// Admin security & user management commands
#[tauri::command]
async fn get_admin_security_info(admin_email: String) -> Result<DeviceSecurityInfo, String> {
    admin::get_admin_security_info(&admin_email).await
}

#[tauri::command]
async fn update_admin_security_policy(
    admin_email: String,
    device_binding: bool,
    trusted_device: Option<String>,
    ip_binding: bool,
    trusted_ip: Option<String>,
) -> Result<DeviceSecurityInfo, String> {
    admin::update_admin_security_policy(&admin_email, device_binding, trusted_device, ip_binding, trusted_ip).await
}

#[tauri::command]
async fn admin_update_user(
    admin_email: String,
    target_id: i32,
    new_username: Option<String>,
    new_email: Option<String>,
    new_role: Option<String>,
    new_password: Option<String>,
) -> Result<String, String> {
    admin::admin_update_user(&admin_email, target_id, new_username, new_email, new_role, new_password).await
}

#[tauri::command]
async fn admin_delete_user(admin_email: String, target_id: i32) -> Result<String, String> {
    admin::admin_delete_user(&admin_email, target_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    auth::load_env();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            check_db,
            login,
            register,
            request_reset_code,
            verify_reset_code,
            reset_password,
            get_db_info,
            get_storage_stats,
            list_storage_items,
            create_server_folder,
            delete_server_item,
            rename_server_item,
            upload_server_file,
            list_server_users,
            get_admin_security_info,
            update_admin_security_policy,
            admin_update_user,
            admin_delete_user
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
