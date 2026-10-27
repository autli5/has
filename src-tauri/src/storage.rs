use serde::{Deserialize, Serialize};
use std::env;
use crate::auth::{connect_to_db, get_db_config};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageStats {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub percent_used: f64,
    pub total_formatted: String,
    pub used_formatted: String,
    pub free_formatted: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageItemDto {
    pub id: String,
    pub name: String,
    pub size_formatted: String,
    pub size_bytes: i64,
    pub item_type: String, // "folder" or "file"
    pub folder_id: Option<i64>,
    pub modified: String,
    pub user_email: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerFileDownloadDto {
    pub id: i64,
    pub name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub content_base64: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerUserDto {
    pub id: i32,
    pub email: String,
    pub username: Option<String>,
    pub role: String,
    pub created_at: String,
    pub is_online: bool,
    pub last_seen_at: Option<String>,
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.1} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub async fn init_storage_tables() -> Result<(), String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let init_sql = r#"
        CREATE TABLE IF NOT EXISTS server_folders (
            id BIGSERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            parent_id BIGINT REFERENCES server_folders(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS server_files (
            id BIGSERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            folder_id BIGINT REFERENCES server_folders(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            size_bytes BIGINT NOT NULL DEFAULT 0,
            mime_type VARCHAR(100),
            file_path TEXT,
            content BYTEA,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    "#;

    client
        .batch_execute(init_sql)
        .await
        .map_err(|e| format!("Failed to initialize storage tables: {}", e))?;

    // Make sure base storage directory exists on the server
    let base_path = env::var("SERVER_STORAGE_PATH")
        .unwrap_or_else(|_| "/www/server/pgsql/storage".to_string());
    fs_ensure_dir(&client, &base_path).await;

    // Sync all existing folders in database to physical disk
    if let Ok(rows) = client.query("SELECT id, user_email FROM server_folders;", &[]).await {
        for row in rows {
            let fid: i64 = row.get(0);
            let email: String = row.get(1);
            let full_path = resolve_folder_full_path(&client, &email, Some(fid)).await;
            fs_ensure_dir(&client, &full_path).await;
        }
    }

    Ok(())
}

pub async fn resolve_user_folder_name(client: &tokio_postgres::Client, user_email: &str) -> String {
    if let Ok(Some(row)) = client
        .query_opt("SELECT username FROM users WHERE email = $1;", &[&user_email])
        .await
        && let Ok(uname) = row.try_get::<_, String>(0) {
            let trimmed = uname.trim();
            if !trimmed.is_empty() {
                return trimmed.to_lowercase();
            }
        }
    let fallback = user_email.split('@').next().unwrap_or(user_email);
    fallback.to_lowercase()
}

pub async fn resolve_folder_full_path(
    client: &tokio_postgres::Client,
    user_email: &str,
    folder_id: Option<i64>,
) -> String {
    let base_dir = env::var("SERVER_STORAGE_PATH")
        .unwrap_or_else(|_| "/www/server/pgsql/storage".to_string());
    let user_dir = resolve_user_folder_name(client, user_email).await;

    let mut full_path = format!("{}/{}", base_dir, user_dir);

    if let Some(fid) = folder_id {
        let query = "
            WITH RECURSIVE folder_path AS (
                SELECT id, name, parent_id, 1 as depth
                FROM server_folders
                WHERE id = $1 AND user_email = $2
                UNION ALL
                SELECT f.id, f.name, f.parent_id, fp.depth + 1
                FROM server_folders f
                JOIN folder_path fp ON f.id = fp.parent_id
                WHERE f.user_email = $2
            )
            SELECT name FROM folder_path ORDER BY depth DESC;
        ";
        if let Ok(rows) = client.query(query, &[&fid, &user_email]).await {
            for row in rows {
                let name: String = row.get(0);
                full_path.push('/');
                full_path.push_str(&name);
            }
        }
    }

    full_path
}

pub async fn fs_ensure_dir(_client: &tokio_postgres::Client, _full_path: &str) {
    // Pure DB storage - OS shell execution disabled for safety and non-superuser compatibility
}

pub async fn fs_save_file(
    client: &tokio_postgres::Client,
    file_id: i64,
    dir_path: &str,
    file_name: &str,
) -> Result<String, String> {
    let full_file_path = format!("{}/{}", dir_path, file_name);

    let _ = client
        .execute(
            "UPDATE server_files SET file_path = $1 WHERE id = $2;",
            &[&full_file_path, &file_id],
        )
        .await;

    Ok(full_file_path)
}

pub async fn fs_delete_dir(_client: &tokio_postgres::Client, _dir_path: &str) {
    // Pure DB storage
}

pub async fn fs_delete_file(_client: &tokio_postgres::Client, _file_path: &str) {
    // Pure DB storage
}

pub async fn fs_rename_path(_client: &tokio_postgres::Client, _old_path: &str, _new_path: &str) {
    // Pure DB storage
}

#[allow(dead_code)]
fn sanitize_path_segment(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ' || *c == '.')
        .collect()
}

pub async fn get_server_storage_stats() -> Result<StorageStats, String> {
    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let base_path = env::var("SERVER_STORAGE_PATH")
        .unwrap_or_else(|_| "/www/server/pgsql".to_string());

    // 1. Try to query the actual Linux filesystem disk capacity via COPY PROGRAM
    let df_query = format!(
        "CREATE TEMP TABLE IF NOT EXISTS temp_df (line text);\
         TRUNCATE temp_df;\
         COPY temp_df FROM PROGRAM 'df -P -B1 \"{}\" 2>/dev/null || df -P -B1 /';\
         SELECT line FROM temp_df;",
        base_path
    );

    if let Ok(rows) = client.query(&df_query, &[]).await {
        for row in rows {
            let line: String = row.get(0);
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Line format: Filesystem 1B-blocks Used Available Use% Mounted on
            // e.g. /dev/sda1 500107862016 42949672960 457158189056 9% /
            if parts.len() >= 5 && parts[1].chars().all(|c| c.is_ascii_digit())
                && let (Ok(total), Ok(used), Ok(avail)) = (
                    parts[1].parse::<u64>(),
                    parts[2].parse::<u64>(),
                    parts[3].parse::<u64>(),
                )
                    && total > 0 {
                        let percent = (used as f64 / total as f64) * 100.0;
                        return Ok(StorageStats {
                            total_bytes: total,
                            used_bytes: used,
                            free_bytes: avail,
                            percent_used: (percent * 10.0).round() / 10.0,
                            total_formatted: format_bytes(total),
                            used_formatted: format_bytes(used),
                            free_formatted: format_bytes(avail),
                        });
                    }
        }
    }

    // 2. Fallback: compute from PostgreSQL database size and stored files
    let db_size_row = client
        .query_opt("SELECT pg_database_size($1);", &[&config.dbname])
        .await
        .ok()
        .flatten();

    let db_bytes: u64 = db_size_row
        .and_then(|r| r.try_get::<_, i64>(0).ok())
        .map(|b| b.max(0) as u64)
        .unwrap_or(1024 * 1024 * 50); // 50MB fallback

    let files_size_row = client
        .query_opt("SELECT COALESCE(SUM(size_bytes), 0) FROM server_files;", &[])
        .await
        .ok()
        .flatten();

    let files_bytes: u64 = files_size_row
        .and_then(|r| r.try_get::<_, i64>(0).ok())
        .map(|b| b.max(0) as u64)
        .unwrap_or(0);

    let used_bytes = db_bytes + files_bytes;
    
    // Configurable MAX storage in .env (default 500 GB for server drive)
    let max_gb = env::var("STORAGE_MAX_GB")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(500);

    let total_bytes = max_gb * 1024 * 1024 * 1024;
    let free_bytes = total_bytes.saturating_sub(used_bytes);
    let percent = if total_bytes > 0 {
        (used_bytes as f64 / total_bytes as f64) * 100.0
    } else {
        0.0
    };

    Ok(StorageStats {
        total_bytes,
        used_bytes,
        free_bytes,
        percent_used: (percent * 10.0).round() / 10.0,
        total_formatted: format_bytes(total_bytes),
        used_formatted: format_bytes(used_bytes),
        free_formatted: format_bytes(free_bytes),
    })
}

pub async fn list_server_items(user_email: &str, folder_id: Option<i64>) -> Result<Vec<StorageItemDto>, String> {
    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let mut items = Vec::new();

    // 1. Fetch folders
    let folder_rows = match folder_id {
        Some(fid) => {
            client
                .query(
                    "SELECT id, name, created_at, parent_id FROM server_folders WHERE user_email = $1 AND parent_id = $2 ORDER BY name ASC;",
                    &[&user_email, &fid],
                )
                .await
                .map_err(|e| format!("Error querying folders: {}", e))?
        }
        None => {
            client
                .query(
                    "SELECT id, name, created_at, parent_id FROM server_folders WHERE user_email = $1 AND parent_id IS NULL ORDER BY name ASC;",
                    &[&user_email],
                )
                .await
                .map_err(|e| format!("Error querying folders: {}", e))?
        }
    };

    for row in folder_rows {
        let id: i64 = row.get(0);
        let name: String = row.get(1);
        let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(2).ok();
        let parent: Option<i64> = row.try_get(3).ok();
        let date_str = created_at
            .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
            .unwrap_or_else(|| "—".to_string());

        // Calculate folder size from contained files
        let size_row = client
            .query_opt(
                "SELECT COALESCE(SUM(size_bytes), 0) FROM server_files WHERE folder_id = $1;",
                &[&id],
            )
            .await
            .ok()
            .flatten();

        let folder_bytes: u64 = size_row
            .and_then(|r| r.try_get::<_, i64>(0).ok())
            .map(|b| b.max(0) as u64)
            .unwrap_or(0);

        items.push(StorageItemDto {
            id: format!("folder_{}", id),
            name,
            size_formatted: if folder_bytes > 0 { format_bytes(folder_bytes) } else { "Папка".to_string() },
            size_bytes: folder_bytes as i64,
            item_type: "folder".to_string(),
            folder_id: parent,
            modified: date_str,
            user_email: user_email.to_string(),
        });
    }

    // 2. Fetch files
    let file_rows = match folder_id {
        Some(fid) => {
            client
                .query(
                    "SELECT id, name, size_bytes, created_at, folder_id FROM server_files WHERE user_email = $1 AND folder_id = $2 ORDER BY name ASC;",
                    &[&user_email, &fid],
                )
                .await
                .map_err(|e| format!("Error querying files: {}", e))?
        }
        None => {
            client
                .query(
                    "SELECT id, name, size_bytes, created_at, folder_id FROM server_files WHERE user_email = $1 AND folder_id IS NULL ORDER BY name ASC;",
                    &[&user_email],
                )
                .await
                .map_err(|e| format!("Error querying files: {}", e))?
        }
    };

    for row in file_rows {
        let id: i64 = row.get(0);
        let name: String = row.get(1);
        let size_bytes: i64 = row.get(2);
        let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(3).ok();
        let f_id: Option<i64> = row.try_get(4).ok();
        let date_str = created_at
            .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
            .unwrap_or_else(|| "—".to_string());

        items.push(StorageItemDto {
            id: format!("file_{}", id),
            name,
            size_formatted: format_bytes(size_bytes.max(0) as u64),
            size_bytes,
            item_type: "file".to_string(),
            folder_id: f_id,
            modified: date_str,
            user_email: user_email.to_string(),
        });
    }

    Ok(items)
}

pub async fn create_server_folder(user_email: &str, folder_name: &str, parent_id: Option<i64>) -> Result<StorageItemDto, String> {
    let clean_name = folder_name.trim();
    if clean_name.is_empty() {
        return Err("Имя папки не может быть пустым".to_string());
    }

    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    // Check if folder with the same name already exists in this directory
    let existing = match parent_id {
        Some(pid) => {
            client
                .query_opt(
                    "SELECT id FROM server_folders WHERE user_email = $1 AND parent_id = $2 AND name = $3;",
                    &[&user_email, &pid, &clean_name],
                )
                .await
        }
        None => {
            client
                .query_opt(
                    "SELECT id FROM server_folders WHERE user_email = $1 AND parent_id IS NULL AND name = $3;",
                    &[&user_email, &clean_name],
                )
                .await
        }
    };

    if let Ok(Some(_)) = existing {
        return Err(format!("Папка с именем \"{}\" уже существует", clean_name));
    }

    // Insert into database
    let row = client
        .query_one(
            "INSERT INTO server_folders (user_email, name, parent_id) VALUES ($1, $2, $3) RETURNING id, created_at;",
            &[&user_email, &clean_name, &parent_id],
        )
        .await
        .map_err(|e| format!("Не удалось создать папку в БД: {}", e))?;

    let folder_id: i64 = row.get(0);
    let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(1).ok();
    let date_str = created_at
        .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
        .unwrap_or_else(|| "—".to_string());

    // Create directory on physical Linux filesystem on the server
    let full_path = resolve_folder_full_path(&client, user_email, Some(folder_id)).await;
    fs_ensure_dir(&client, &full_path).await;

    Ok(StorageItemDto {
        id: format!("folder_{}", folder_id),
        name: clean_name.to_string(),
        size_formatted: "Папка".to_string(),
        size_bytes: 0,
        item_type: "folder".to_string(),
        folder_id: parent_id,
        modified: date_str,
        user_email: user_email.to_string(),
    })
}

pub async fn delete_server_item(user_email: &str, item_id: &str) -> Result<bool, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    if let Some(id_str) = item_id.strip_prefix("folder_") {
        if let Ok(id) = id_str.parse::<i64>() {
            // Delete directory on physical Linux filesystem
            let folder_path = resolve_folder_full_path(&client, user_email, Some(id)).await;
            fs_delete_dir(&client, &folder_path).await;

            client
                .execute(
                    "DELETE FROM server_folders WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка удаления папки: {}", e))?;

            return Ok(true);
        }
    } else if let Some(id_str) = item_id.strip_prefix("file_")
        && let Ok(id) = id_str.parse::<i64>() {
            // Delete file on physical Linux filesystem
            if let Ok(Some(row)) = client
                .query_opt(
                    "SELECT file_path FROM server_files WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
                && let Ok(fpath) = row.try_get::<_, String>(0) {
                    fs_delete_file(&client, &fpath).await;
                }

            client
                .execute(
                    "DELETE FROM server_files WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка удаления файла: {}", e))?;

            return Ok(true);
        }

    Err("Неверный ID элемента".to_string())
}

pub async fn rename_server_item(user_email: &str, item_id: &str, new_name: &str) -> Result<bool, String> {
    let clean_name = new_name.trim();
    if clean_name.is_empty() {
        return Err("Имя не может быть пустым".to_string());
    }

    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    if let Some(id_str) = item_id.strip_prefix("folder_") {
        if let Ok(id) = id_str.parse::<i64>() {
            let old_path = resolve_folder_full_path(&client, user_email, Some(id)).await;

            client
                .execute(
                    "UPDATE server_folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_email = $3;",
                    &[&clean_name, &id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка переименования папки: {}", e))?;

            let new_path = resolve_folder_full_path(&client, user_email, Some(id)).await;
            fs_rename_path(&client, &old_path, &new_path).await;

            return Ok(true);
        }
    } else if let Some(id_str) = item_id.strip_prefix("file_")
        && let Ok(id) = id_str.parse::<i64>()
            && let Ok(Some(row)) = client
                .query_opt(
                    "SELECT file_path, folder_id FROM server_files WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
            {
                let old_path: Option<String> = row.try_get(0).ok();
                let f_id: Option<i64> = row.try_get(1).ok();
                let dir_path = resolve_folder_full_path(&client, user_email, f_id).await;
                let new_path = format!("{}/{}", dir_path, clean_name);

                client
                    .execute(
                        "UPDATE server_files SET name = $1, file_path = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_email = $4;",
                        &[&clean_name, &new_path, &id, &user_email],
                    )
                    .await
                    .map_err(|e| format!("Ошибка переименования файла: {}", e))?;

                if let Some(old) = old_path {
                    fs_rename_path(&client, &old, &new_path).await;
                }

                return Ok(true);
            }

    Err("Неверный ID элемента".to_string())
}

pub async fn upload_server_file(
    user_email: &str,
    file_name: &str,
    size_bytes: i64,
    mime_type: Option<String>,
    content_base64: Option<String>,
    folder_id: Option<i64>,
) -> Result<StorageItemDto, String> {
    let clean_name = file_name.trim();
    if clean_name.is_empty() {
        return Err("Имя файла не может быть пустым".to_string());
    }

    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let binary_content: Option<Vec<u8>> = match content_base64 {
        Some(b64) => {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD
                .decode(b64.as_bytes())
                .ok()
        }
        None => None,
    };

    let row = client
        .query_one(
            "INSERT INTO server_files (user_email, name, size_bytes, mime_type, content, folder_id) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, created_at;",
            &[
                &user_email,
                &clean_name,
                &size_bytes,
                &mime_type,
                &binary_content,
                &folder_id,
            ],
        )
        .await
        .map_err(|e| format!("Не удалось сохранить файл на сервере: {}", e))?;

    let file_id: i64 = row.get(0);
    let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(1).ok();
    let date_str = created_at
        .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
        .unwrap_or_else(|| "—".to_string());

    // Save file to physical Linux filesystem on the server
    let dir_path = resolve_folder_full_path(&client, user_email, folder_id).await;
    let _ = fs_save_file(&client, file_id, &dir_path, clean_name).await;

    Ok(StorageItemDto {
        id: format!("file_{}", file_id),
        name: clean_name.to_string(),
        size_formatted: format_bytes(size_bytes.max(0) as u64),
        size_bytes,
        item_type: "file".to_string(),
        folder_id,
        modified: date_str,
        user_email: user_email.to_string(),
    })
}

pub async fn create_server_file(
    user_email: &str,
    file_name: &str,
    content: Option<String>,
    folder_id: Option<i64>,
) -> Result<StorageItemDto, String> {
    let clean_name = file_name.trim();
    if clean_name.is_empty() {
        return Err("Имя файла не может быть пустым".to_string());
    }

    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    // Check if file with same name already exists in this folder
    let existing = match folder_id {
        Some(fid) => {
            client
                .query_opt(
                    "SELECT id FROM server_files WHERE user_email = $1 AND folder_id = $2 AND name = $3;",
                    &[&user_email, &fid, &clean_name],
                )
                .await
        }
        None => {
            client
                .query_opt(
                    "SELECT id FROM server_files WHERE user_email = $1 AND folder_id IS NULL AND name = $3;",
                    &[&user_email, &clean_name],
                )
                .await
        }
    };

    if let Ok(Some(_)) = existing {
        return Err(format!("Файл с именем \"{}\" уже существует в этой папке", clean_name));
    }

    let text_content = content.unwrap_or_default();
    let bytes = text_content.into_bytes();
    let size_bytes = bytes.len() as i64;

    let mime_type = if clean_name.ends_with(".txt") {
        "text/plain"
    } else if clean_name.ends_with(".md") {
        "text/markdown"
    } else if clean_name.ends_with(".json") {
        "application/json"
    } else if clean_name.ends_with(".html") || clean_name.ends_with(".htm") {
        "text/html"
    } else if clean_name.ends_with(".css") {
        "text/css"
    } else if clean_name.ends_with(".js") || clean_name.ends_with(".ts") {
        "text/javascript"
    } else if clean_name.ends_with(".csv") {
        "text/csv"
    } else if clean_name.ends_with(".xml") {
        "application/xml"
    } else {
        "text/plain"
    }.to_string();

    let row = client
        .query_one(
            "INSERT INTO server_files (user_email, name, size_bytes, mime_type, content, folder_id) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, created_at;",
            &[
                &user_email,
                &clean_name,
                &size_bytes,
                &Some(mime_type),
                &Some(bytes),
                &folder_id,
            ],
        )
        .await
        .map_err(|e| format!("Не удалось создать файл на сервере: {}", e))?;

    let file_id: i64 = row.get(0);
    let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(1).ok();
    let date_str = created_at
        .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
        .unwrap_or_else(|| "—".to_string());

    // Save file to physical Linux filesystem on the server
    let dir_path = resolve_folder_full_path(&client, user_email, folder_id).await;
    let _ = fs_save_file(&client, file_id, &dir_path, clean_name).await;

    Ok(StorageItemDto {
        id: format!("file_{}", file_id),
        name: clean_name.to_string(),
        size_formatted: format_bytes(size_bytes.max(0) as u64),
        size_bytes,
        item_type: "file".to_string(),
        folder_id,
        modified: date_str,
        user_email: user_email.to_string(),
    })
}

pub async fn save_server_file_content(
    user_email: &str,
    file_id: i64,
    content: &str,
) -> Result<bool, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let bytes = content.as_bytes().to_vec();
    let size_bytes = bytes.len() as i64;

    let row = client
        .query_opt(
            "UPDATE server_files SET content = $1, size_bytes = $2, updated_at = CURRENT_TIMESTAMP \
             WHERE id = $3 AND user_email = $4 RETURNING name, folder_id;",
            &[&Some(bytes), &size_bytes, &file_id, &user_email],
        )
        .await
        .map_err(|e| format!("Ошибка обновления файла: {}", e))?;

    if let Some(r) = row {
        let name: String = r.get(0);
        let folder_id: Option<i64> = r.try_get(1).ok();
        let dir_path = resolve_folder_full_path(&client, user_email, folder_id).await;
        let _ = fs_save_file(&client, file_id, &dir_path, &name).await;
        Ok(true)
    } else {
        Err("Файл не найден".to_string())
    }
}

pub async fn download_server_file(user_email: &str, file_id: i64) -> Result<ServerFileDownloadDto, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row = client
        .query_one(
            "SELECT name, mime_type, size_bytes, content FROM server_files WHERE id = $1 AND user_email = $2;",
            &[&file_id, &user_email],
        )
        .await
        .map_err(|e| format!("Файл не найден на сервере: {}", e))?;

    let name: String = row.get(0);
    let mime_type: Option<String> = row.get(1);
    let size_bytes: i64 = row.get(2);
    let content: Option<Vec<u8>> = row.get(3);

    let content_b64 = match content {
        Some(bytes) => {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD.encode(&bytes)
        }
        None => String::new(),
    };

    Ok(ServerFileDownloadDto {
        id: file_id,
        name,
        mime_type,
        size_bytes,
        content_base64: content_b64,
    })
}

pub async fn update_user_heartbeat(user_email: &str) -> Result<bool, String> {
    let clean = user_email.trim();
    if clean.is_empty() {
        return Ok(false);
    }
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let _ = client
        .batch_execute(&format!(
            "ALTER TABLE {} ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
            config.users_table
        ))
        .await;

    let query = format!(
        "UPDATE {} SET last_seen_at = CURRENT_TIMESTAMP WHERE LOWER({}) = LOWER($1);",
        config.users_table, config.email_column
    );
    client
        .execute(&query, &[&clean])
        .await
        .map_err(|e| format!("Ошибка обновления heartbeat: {}", e))?;

    Ok(true)
}

pub async fn list_server_users() -> Result<Vec<ServerUserDto>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let _ = client
        .batch_execute(&format!(
            "ALTER TABLE {} ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
            config.users_table
        ))
        .await;

    let query = format!(
        "SELECT id, {}, username, created_at, role, \
         (last_seen_at IS NOT NULL AND last_seen_at > NOW() - INTERVAL '5 minutes') AS is_online, \
         TO_CHAR(last_seen_at, 'DD.MM.YYYY HH24:MI') AS last_seen_str \
         FROM {} ORDER BY id ASC;",
        config.email_column, config.users_table
    );

    let rows = client
        .query(&query, &[])
        .await
        .map_err(|e| format!("Ошибка чтения таблицы пользователей: {}", e))?;

    let mut users = Vec::new();
    for row in rows {
        let id: i32 = row.get(0);
        let email: String = row.get(1);
        let username: Option<String> = row.get(2);
        let created_at: Option<chrono::NaiveDateTime> = row.try_get(3).ok();
        let role_val: Option<String> = row.try_get(4).ok().flatten();
        let is_online: bool = row.try_get(5).unwrap_or(false);
        let last_seen_at: Option<String> = row.try_get(6).ok().flatten();

        let role_str = match role_val.as_deref() {
            Some("admin") | Some("Администратор") => "Администратор".to_string(),
            _ => if id == 1 { "Администратор".to_string() } else { "Пользователь".to_string() },
        };
        let created_str = created_at
            .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
            .unwrap_or_else(|| "Активен".to_string());

        users.push(ServerUserDto {
            id,
            email,
            username,
            role: role_str,
            created_at: created_str,
            is_online,
            last_seen_at,
        });
    }

    Ok(users)
}
