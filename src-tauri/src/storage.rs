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
    pub modified: String,
    pub user_email: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerUserDto {
    pub id: i32,
    pub email: String,
    pub username: Option<String>,
    pub role: String,
    pub created_at: String,
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

    Ok(())
}

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
            if parts.len() >= 5 && parts[1].chars().all(|c| c.is_ascii_digit()) {
                if let (Ok(total), Ok(used), Ok(avail)) = (
                    parts[1].parse::<u64>(),
                    parts[2].parse::<u64>(),
                    parts[3].parse::<u64>(),
                ) {
                    if total > 0 {
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

pub async fn list_server_items(user_email: &str) -> Result<Vec<StorageItemDto>, String> {
    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let mut items = Vec::new();

    // 1. Fetch folders
    let folder_rows = client
        .query(
            "SELECT id, name, created_at FROM server_folders WHERE user_email = $1 ORDER BY name ASC;",
            &[&user_email],
        )
        .await
        .map_err(|e| format!("Error querying folders: {}", e))?;

    for row in folder_rows {
        let id: i64 = row.get(0);
        let name: String = row.get(1);
        let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(2).ok();
        let date_str = created_at
            .map(|dt| dt.format("%Y/%m/%d").to_string())
            .unwrap_or_else(|| "2026/10/14".to_string());

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
            modified: date_str,
            user_email: user_email.to_string(),
        });
    }

    // 2. Fetch standalone files (in root folder)
    let file_rows = client
        .query(
            "SELECT id, name, size_bytes, created_at FROM server_files WHERE user_email = $1 AND folder_id IS NULL ORDER BY name ASC;",
            &[&user_email],
        )
        .await
        .map_err(|e| format!("Error querying files: {}", e))?;

    for row in file_rows {
        let id: i64 = row.get(0);
        let name: String = row.get(1);
        let size_bytes: i64 = row.get(2);
        let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(3).ok();
        let date_str = created_at
            .map(|dt| dt.format("%Y/%m/%d").to_string())
            .unwrap_or_else(|| "2026/10/14".to_string());

        items.push(StorageItemDto {
            id: format!("file_{}", id),
            name,
            size_formatted: format_bytes(size_bytes.max(0) as u64),
            size_bytes,
            item_type: "file".to_string(),
            modified: date_str,
            user_email: user_email.to_string(),
        });
    }

    // If this is a new user with 0 items, seed standard default folders
    if items.is_empty() {
        let default_folders = ["Документы", "Изображения", "Видео", "Загрузки"];
        for folder_name in default_folders {
            let _ = create_server_folder(user_email, folder_name).await;
        }
        // Recursively reload
        return Box::pin(list_server_items(user_email)).await;
    }

    Ok(items)
}

pub async fn create_server_folder(user_email: &str, folder_name: &str) -> Result<StorageItemDto, String> {
    let clean_name = folder_name.trim();
    if clean_name.is_empty() {
        return Err("Имя папки не может быть пустым".to_string());
    }

    let _ = init_storage_tables().await;
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    // Insert into database
    let row = client
        .query_one(
            "INSERT INTO server_folders (user_email, name) VALUES ($1, $2) RETURNING id, created_at;",
            &[&user_email, &clean_name],
        )
        .await
        .map_err(|e| format!("Не удалось создать папку в БД: {}", e))?;

    let folder_id: i64 = row.get(0);
    let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(1).ok();
    let date_str = created_at
        .map(|dt| dt.format("%Y/%m/%d").to_string())
        .unwrap_or_else(|| "2026/10/14".to_string());

    // Actually create the directory on the Linux server filesystem
    let base_path = env::var("SERVER_STORAGE_PATH")
        .unwrap_or_else(|_| "/www/server/pgsql/storage".to_string());
    let safe_user = sanitize_path_segment(user_email);
    let safe_folder = sanitize_path_segment(clean_name);

    let mkdir_cmd = format!(
        "COPY (SELECT 1) TO PROGRAM 'mkdir -p \"{}/{}/{}\" 2>/dev/null || true';",
        base_path, safe_user, safe_folder
    );
    let _ = client.batch_execute(&mkdir_cmd).await;

    Ok(StorageItemDto {
        id: format!("folder_{}", folder_id),
        name: clean_name.to_string(),
        size_formatted: "Папка".to_string(),
        size_bytes: 0,
        item_type: "folder".to_string(),
        modified: date_str,
        user_email: user_email.to_string(),
    })
}

pub async fn delete_server_item(user_email: &str, item_id: &str) -> Result<bool, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    if let Some(id_str) = item_id.strip_prefix("folder_") {
        if let Ok(id) = id_str.parse::<i64>() {
            // Get folder name for filesystem deletion
            if let Ok(Some(row)) = client
                .query_opt(
                    "SELECT name FROM server_folders WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
            {
                let name: String = row.get(0);
                let base_path = env::var("SERVER_STORAGE_PATH")
                    .unwrap_or_else(|_| "/www/server/pgsql/storage".to_string());
                let safe_user = sanitize_path_segment(user_email);
                let safe_folder = sanitize_path_segment(&name);

                let rmdir_cmd = format!(
                    "COPY (SELECT 1) TO PROGRAM 'rm -rf \"{}/{}/{}\" 2>/dev/null || true';",
                    base_path, safe_user, safe_folder
                );
                let _ = client.batch_execute(&rmdir_cmd).await;
            }

            client
                .execute(
                    "DELETE FROM server_folders WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка удаления папки: {}", e))?;

            return Ok(true);
        }
    } else if let Some(id_str) = item_id.strip_prefix("file_") {
        if let Ok(id) = id_str.parse::<i64>() {
            client
                .execute(
                    "DELETE FROM server_files WHERE id = $1 AND user_email = $2;",
                    &[&id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка удаления файла: {}", e))?;

            return Ok(true);
        }
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
            client
                .execute(
                    "UPDATE server_folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_email = $3;",
                    &[&clean_name, &id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка переименования папки: {}", e))?;

            return Ok(true);
        }
    } else if let Some(id_str) = item_id.strip_prefix("file_") {
        if let Ok(id) = id_str.parse::<i64>() {
            client
                .execute(
                    "UPDATE server_files SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_email = $3;",
                    &[&clean_name, &id, &user_email],
                )
                .await
                .map_err(|e| format!("Ошибка переименования файла: {}", e))?;

            return Ok(true);
        }
    }

    Err("Неверный ID элемента".to_string())
}

pub async fn upload_server_file(
    user_email: &str,
    file_name: &str,
    size_bytes: i64,
    mime_type: Option<String>,
    content_base64: Option<String>,
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
            "INSERT INTO server_files (user_email, name, size_bytes, mime_type, content) \
             VALUES ($1, $2, $3, $4, $5) \
             RETURNING id, created_at;",
            &[
                &user_email,
                &clean_name,
                &size_bytes,
                &mime_type,
                &binary_content,
            ],
        )
        .await
        .map_err(|e| format!("Не удалось сохранить файл на сервере: {}", e))?;

    let file_id: i64 = row.get(0);
    let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get(1).ok();
    let date_str = created_at
        .map(|dt| dt.format("%Y/%m/%d").to_string())
        .unwrap_or_else(|| "2026/10/14".to_string());

    Ok(StorageItemDto {
        id: format!("file_{}", file_id),
        name: clean_name.to_string(),
        size_formatted: format_bytes(size_bytes.max(0) as u64),
        size_bytes,
        item_type: "file".to_string(),
        modified: date_str,
        user_email: user_email.to_string(),
    })
}

pub async fn list_server_users() -> Result<Vec<ServerUserDto>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let query = format!(
        "SELECT id, {}, username, created_at FROM {} ORDER BY id ASC;",
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
        let created_at: Option<chrono::NaiveDateTime> = row.get(3);
        let created_str = created_at
            .map(|dt| dt.format("%d.%m.%Y %H:%M").to_string())
            .unwrap_or_else(|| "Активен".to_string());

        users.push(ServerUserDto {
            id,
            email,
            username,
            role: if id == 1 { "Администратор".to_string() } else { "Пользователь".to_string() },
            created_at: created_str,
        });
    }

    Ok(users)
}
