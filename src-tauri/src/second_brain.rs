use serde::{Deserialize, Serialize};
use std::env;
use crate::auth::{connect_to_db, get_db_config};
use crate::storage::{fs_ensure_dir, resolve_user_folder_name};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSummaryDto {
    pub id: i64,
    pub title: String,
    pub folder: String,       // "00_Inbox", "01_Projects", "02_Areas", "03_Resources", "04_Archive"
    pub note_type: String,    // "inbox", "project", "area", "resource", "archive"
    pub status: String,       // "draft", "in-progress", "completed", "permanent"
    pub tags: Vec<String>,
    pub links: Vec<String>,
    pub summary: Option<String>,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteDetailDto {
    pub id: i64,
    pub title: String,
    pub folder: String,
    pub note_type: String,
    pub status: String,
    pub tags: Vec<String>,
    pub links: Vec<String>,
    pub summary: Option<String>,
    pub content: String,
    pub file_path: Option<String>,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSaveDto {
    pub id: Option<i64>,
    pub title: String,
    pub folder: String,
    pub note_type: String,
    pub status: String,
    pub tags: Vec<String>,
    pub links: Vec<String>,
    pub summary: Option<String>,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotesStatsDto {
    pub total_notes: usize,
    pub inbox_count: usize,
    pub projects_count: usize,
    pub areas_count: usize,
    pub resources_count: usize,
    pub archive_count: usize,
    pub all_tags: Vec<String>,
}

fn get_second_brain_base_path(user_dir: &str) -> String {
    let base = env::var("SERVER_STORAGE_PATH")
        .unwrap_or_else(|_| "/www/server/pgsql/storage".to_string());
    format!("{}/{}/SecondBrain", base, user_dir)
}

pub async fn init_notes_tables(client: &tokio_postgres::Client) -> Result<(), String> {
    let sql = "
        CREATE TABLE IF NOT EXISTS server_notes (
            id BIGSERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            folder VARCHAR(50) NOT NULL,
            note_type VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            tags TEXT[] DEFAULT '{}',
            links TEXT[] DEFAULT '{}',
            summary TEXT,
            content TEXT NOT NULL,
            file_path VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_server_notes_user ON server_notes(user_email);
        CREATE INDEX IF NOT EXISTS idx_server_notes_folder ON server_notes(folder);
    ";
    client
        .batch_execute(sql)
        .await
        .map_err(|e| format!("Ошибка создания таблицы заметок: {}", e))?;
    Ok(())
}

async fn sync_note_to_disk(
    client: &tokio_postgres::Client,
    user_email: &str,
    folder: &str,
    title: &str,
    content: &str,
) -> String {
    use base64::Engine;

    let user_dir = resolve_user_folder_name(client, user_email).await;
    let brain_dir = get_second_brain_base_path(&user_dir);
    let target_folder_dir = format!("{}/{}", brain_dir, folder);
    fs_ensure_dir(client, &target_folder_dir).await;

    // Sanitize title for filename
    let safe_title: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let safe_title = safe_title.trim();
    let filename = if safe_title.is_empty() { "Untitled.md" } else { &format!("{}.md", safe_title) };
    let full_path = format!("{}/{}", target_folder_dir, filename);

    let b64_path = base64::engine::general_purpose::STANDARD.encode(full_path.as_bytes());
    let b64_content = base64::engine::general_purpose::STANDARD.encode(content.as_bytes());

    let write_cmd = format!(
        "COPY (SELECT 1) TO PROGRAM 'python3 -c \"import base64; p = base64.b64decode(\\\"{}\\\").decode(\\\"utf-8\\\"); data = base64.b64decode(\\\"{}\\\"); open(p, \\\"wb\\\").write(data)\" 2>/dev/null || true';",
        b64_path, b64_content
    );
    let _ = client.batch_execute(&write_cmd).await;

    full_path
}

#[tauri::command]
pub async fn list_server_notes(
    user_email: String,
    folder: Option<String>,
    tag: Option<String>,
    search: Option<String>,
) -> Result<Vec<NoteSummaryDto>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_notes_tables(&client).await?;

    let mut query = String::from(
        "SELECT id, title, folder, note_type, status, tags, links, summary,
                TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI'),
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI')
         FROM server_notes
         WHERE user_email = $1"
    );

    let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = vec![Box::new(user_email)];
    let mut param_idx = 2;

    if let Some(ref f) = folder {
        if !f.trim().is_empty() && f != "all" {
            query.push_str(&format!(" AND folder = ${}", param_idx));
            params.push(Box::new(f.clone()));
            param_idx += 1;
        }
    }

    if let Some(ref t) = tag {
        if !t.trim().is_empty() {
            query.push_str(&format!(" AND ${} = ANY(tags)", param_idx));
            params.push(Box::new(t.clone()));
            param_idx += 1;
        }
    }

    if let Some(ref s) = search {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            query.push_str(&format!(
                " AND (title ILIKE ${0} OR summary ILIKE ${0} OR content ILIKE ${0})",
                param_idx
            ));
            let pattern = format!("%{}%", trimmed);
            params.push(Box::new(pattern));
        }
    }

    query.push_str(" ORDER BY updated_at DESC, id DESC;");

    let params_slice: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> =
        params.iter().map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync)).collect();

    let rows = client
        .query(&query, &params_slice)
        .await
        .map_err(|e| format!("Ошибка загрузки заметок: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        let id: i64 = row.get(0);
        let title: String = row.get(1);
        let folder: String = row.get(2);
        let note_type: String = row.get(3);
        let status: String = row.get(4);
        let tags: Vec<String> = row.get(5);
        let links: Vec<String> = row.get(6);
        let summary: Option<String> = row.get(7);
        let updated_at: String = row.get(8);
        let created_at: String = row.get(9);

        result.push(NoteSummaryDto {
            id,
            title,
            folder,
            note_type,
            status,
            tags,
            links,
            summary,
            updated_at,
            created_at,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_server_note_by_id(
    user_email: String,
    note_id: i64,
) -> Result<NoteDetailDto, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row = client
        .query_one(
            "SELECT id, title, folder, note_type, status, tags, links, summary, content, file_path,
                    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI'),
                    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI')
             FROM server_notes
             WHERE id = $1 AND user_email = $2;",
            &[&note_id, &user_email],
        )
        .await
        .map_err(|_| "Заметка не найдена".to_string())?;

    Ok(NoteDetailDto {
        id: row.get(0),
        title: row.get(1),
        folder: row.get(2),
        note_type: row.get(3),
        status: row.get(4),
        tags: row.get(5),
        links: row.get(6),
        summary: row.get(7),
        content: row.get(8),
        file_path: row.get(9),
        updated_at: row.get(10),
        created_at: row.get(11),
    })
}

#[tauri::command]
pub async fn save_server_note(
    user_email: String,
    note: NoteSaveDto,
) -> Result<NoteDetailDto, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_notes_tables(&client).await?;

    let title = note.title.trim().to_string();
    if title.is_empty() {
        return Err("Название заметки не может быть пустым".to_string());
    }

    let folder = note.folder.trim().to_string();
    let note_type = note.note_type.trim().to_string();
    let status = note.status.trim().to_string();

    // Auto extract [[links]] from content if not already populated
    let mut links = note.links;
    if links.is_empty() {
        let mut extracted = Vec::new();
        let chars: Vec<char> = note.content.chars().collect();
        let mut i = 0;
        while i + 1 < chars.len() {
            if chars[i] == '[' && chars[i + 1] == '[' {
                if let Some(end) = note.content[i + 2..].find("]]") {
                    let link_name = note.content[i + 2..i + 2 + end].trim();
                    if !link_name.is_empty() && !extracted.contains(&link_name.to_string()) {
                        extracted.push(link_name.to_string());
                    }
                    i += 2 + end + 2;
                    continue;
                }
            }
            i += 1;
        }
        links = extracted;
    }

    // Sync note markdown to physical server disk
    let file_path = sync_note_to_disk(&client, &user_email, &folder, &title, &note.content).await;

    if let Some(existing_id) = note.id {
        // Update existing note
        let row = client
            .query_one(
                "UPDATE server_notes
                 SET title = $1, folder = $2, note_type = $3, status = $4, tags = $5,
                     links = $6, summary = $7, content = $8, file_path = $9, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $10 AND user_email = $11
                 RETURNING id, TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI'), TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI');",
                &[
                    &title,
                    &folder,
                    &note_type,
                    &status,
                    &note.tags,
                    &links,
                    &note.summary,
                    &note.content,
                    &file_path,
                    &existing_id,
                    &user_email,
                ],
            )
            .await
            .map_err(|e| format!("Ошибка обновления заметки: {}", e))?;

        let updated_at: String = row.get(1);
        let created_at: String = row.get(2);

        Ok(NoteDetailDto {
            id: existing_id,
            title,
            folder,
            note_type,
            status,
            tags: note.tags,
            links,
            summary: note.summary,
            content: note.content,
            file_path: Some(file_path),
            updated_at,
            created_at,
        })
    } else {
        // Insert new note
        let row = client
            .query_one(
                "INSERT INTO server_notes (user_email, title, folder, note_type, status, tags, links, summary, content, file_path)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id, TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI'), TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI');",
                &[
                    &user_email,
                    &title,
                    &folder,
                    &note_type,
                    &status,
                    &note.tags,
                    &links,
                    &note.summary,
                    &note.content,
                    &file_path,
                ],
            )
            .await
            .map_err(|e| format!("Ошибка создания заметки: {}", e))?;

        let id: i64 = row.get(0);
        let updated_at: String = row.get(1);
        let created_at: String = row.get(2);

        Ok(NoteDetailDto {
            id,
            title,
            folder,
            note_type,
            status,
            tags: note.tags,
            links,
            summary: note.summary,
            content: note.content,
            file_path: Some(file_path),
            updated_at,
            created_at,
        })
    }
}

#[tauri::command]
pub async fn delete_server_note(user_email: String, note_id: i64) -> Result<bool, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    // Get file path to delete from disk
    if let Ok(Some(row)) = client
        .query_opt(
            "SELECT file_path FROM server_notes WHERE id = $1 AND user_email = $2;",
            &[&note_id, &user_email],
        )
        .await
    {
        if let Some(path) = row.try_get::<_, String>(0).ok() {
            let rm_cmd = format!("rm -f \"{}\" 2>/dev/null || true", path);
            let _ = client.batch_execute(&format!(
                "COPY (SELECT 1) TO PROGRAM '{}';",
                rm_cmd
            )).await;
        }
    }

    client
        .execute(
            "DELETE FROM server_notes WHERE id = $1 AND user_email = $2;",
            &[&note_id, &user_email],
        )
        .await
        .map_err(|e| format!("Ошибка удаления заметки: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn get_notes_stats(user_email: String) -> Result<NotesStatsDto, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_notes_tables(&client).await?;

    let rows = client
        .query(
            "SELECT folder, tags FROM server_notes WHERE user_email = $1;",
            &[&user_email],
        )
        .await
        .map_err(|e| format!("Ошибка подсчета статистики заметок: {}", e))?;

    let mut total_notes = 0;
    let mut inbox_count = 0;
    let mut projects_count = 0;
    let mut areas_count = 0;
    let mut resources_count = 0;
    let mut archive_count = 0;
    let mut all_tags = std::collections::BTreeSet::new();

    for row in rows {
        total_notes += 1;
        let folder: String = row.get(0);
        let tags: Vec<String> = row.get(1);

        for t in tags {
            if !t.trim().is_empty() {
                all_tags.insert(t.trim().to_string());
            }
        }

        match folder.as_str() {
            "00_Inbox" => inbox_count += 1,
            "01_Projects" => projects_count += 1,
            "02_Areas" => areas_count += 1,
            "03_Resources" => resources_count += 1,
            "04_Archive" => archive_count += 1,
            _ => {}
        }
    }

    Ok(NotesStatsDto {
        total_notes,
        inbox_count,
        projects_count,
        areas_count,
        resources_count,
        archive_count,
        all_tags: all_tags.into_iter().collect(),
    })
}
