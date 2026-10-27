use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use crate::auth::{connect_to_db, get_db_config};

static SCHEMA_INITIALIZED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileDto {
    pub id: i32,
    pub email: String,
    pub username: Option<String>,
    pub role: String,
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub notify_email: bool,
    pub notify_sound: bool,
    pub notify_security: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileSaveDto {
    pub username: Option<String>,
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub notify_email: bool,
    pub notify_sound: bool,
    pub notify_security: bool,
}

pub async fn init_profile_columns(client: &tokio_postgres::Client) {
    if SCHEMA_INITIALIZED.load(Ordering::Relaxed) {
        return;
    }

    let sqls = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_sound BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_security BOOLEAN DEFAULT TRUE;",
    ];

    for statement in sqls {
        let _ = client.execute(statement, &[]).await;
    }

    SCHEMA_INITIALIZED.store(true, Ordering::Relaxed);
}

async fn get_existing_user_columns(client: &tokio_postgres::Client) -> HashSet<String> {
    let rows = client
        .query(
            "SELECT LOWER(column_name) FROM information_schema.columns WHERE table_name = 'users'",
            &[],
        )
        .await
        .unwrap_or_default();

    rows.into_iter()
        .filter_map(|r| r.get::<_, Option<String>>(0))
        .collect()
}

async fn fetch_profile_with_client(
    client: &tokio_postgres::Client,
    clean_email: &str,
) -> Result<UserProfileDto, String> {
    init_profile_columns(client).await;
    let cols = get_existing_user_columns(client).await;

    let username_sel = if cols.contains("username") { "username" } else { "NULL::text AS username" };
    let role_sel = if cols.contains("role") { "COALESCE(role, 'user')" } else { "'user'::text AS role" };
    let avatar_sel = if cols.contains("avatar") { "avatar" } else { "NULL::text AS avatar" };
    let bio_sel = if cols.contains("bio") { "bio" } else { "NULL::text AS bio" };
    let notify_email_sel = if cols.contains("notify_email") { "COALESCE(notify_email, TRUE)" } else { "TRUE AS notify_email" };
    let notify_sound_sel = if cols.contains("notify_sound") { "COALESCE(notify_sound, TRUE)" } else { "TRUE AS notify_sound" };
    let notify_security_sel = if cols.contains("notify_security") { "COALESCE(notify_security, TRUE)" } else { "TRUE AS notify_security" };
    let created_at_sel = if cols.contains("created_at") {
        "TO_CHAR(COALESCE(created_at, CURRENT_TIMESTAMP), 'YYYY-MM-DD HH24:MI')"
    } else {
        "TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI') AS created_at"
    };

    let sql = format!(
        "SELECT id, email, {}, {}, {}, {}, {}, {}, {}, {} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;",
        username_sel, role_sel, avatar_sel, bio_sel, notify_email_sel, notify_sound_sel, notify_security_sel, created_at_sel
    );

    let row = client
        .query_opt(&sql, &[&clean_email])
        .await
        .map_err(|e| format!("Ошибка загрузки профиля: {}", e))?
        .ok_or_else(|| "Пользователь не найден в базе данных".to_string())?;

    let mut profile_res = UserProfileDto {
        id: row.get(0),
        email: row.get(1),
        username: row.get(2),
        role: row.get(3),
        avatar: row.get(4),
        bio: row.get(5),
        notify_email: row.get(6),
        notify_sound: row.get(7),
        notify_security: row.get(8),
        created_at: row.get(9),
    };

    // Safely supplement from server_notes __profile_prefs__ if available
    let note_sql = "SELECT content FROM server_notes WHERE LOWER(user_email) = LOWER($1) AND title = '__profile_prefs__' ORDER BY id DESC LIMIT 1;";
    if let Ok(rows) = client.query(note_sql, &[&clean_email]).await
        && let Some(note_row) = rows.first()
            && let Some(json_str) = note_row.get::<_, Option<String>>(0)
                && let Ok(prefs) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if let Some(bio) = prefs.get("bio").and_then(|v| v.as_str()) {
                        profile_res.bio = Some(bio.to_string());
                    }
                    if let Some(avatar) = prefs.get("avatar").and_then(|v| v.as_str())
                        && !avatar.trim().is_empty() {
                            profile_res.avatar = Some(avatar.to_string());
                        }
                    if let Some(notify_email) = prefs.get("notify_email").and_then(|v| v.as_bool()) {
                        profile_res.notify_email = notify_email;
                    }
                    if let Some(notify_sound) = prefs.get("notify_sound").and_then(|v| v.as_bool()) {
                        profile_res.notify_sound = notify_sound;
                    }
                    if let Some(notify_security) = prefs.get("notify_security").and_then(|v| v.as_bool()) {
                        profile_res.notify_security = notify_security;
                    }
                }

    Ok(profile_res)
}

#[tauri::command]
pub async fn get_user_profile(user_email: String) -> Result<UserProfileDto, String> {
    let clean_email = user_email.trim().to_lowercase();
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    fetch_profile_with_client(&client, &clean_email).await
}

#[tauri::command]
pub async fn save_user_profile(
    user_email: String,
    profile: UserProfileSaveDto,
) -> Result<UserProfileDto, String> {
    let clean_email = user_email.trim().to_lowercase();
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    
    init_profile_columns(&client).await;
    let cols = get_existing_user_columns(&client).await;

    let clean_username = profile.username.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let clean_bio = profile.bio.as_deref().map(|s| s.trim());
    let avatar = profile.avatar.filter(|s| !s.trim().is_empty());

    // 1. Dynamic safe UPDATE on users table (only updating columns that actually exist)
    let mut set_clauses = Vec::new();
    let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = Vec::new();

    if cols.contains("username") && clean_username.is_some() {
        params.push(&clean_username);
        set_clauses.push(format!("username = ${}", params.len()));
    }
    if cols.contains("avatar") && avatar.is_some() {
        params.push(&avatar);
        set_clauses.push(format!("avatar = ${}", params.len()));
    }
    if cols.contains("bio") {
        params.push(&clean_bio);
        set_clauses.push(format!("bio = ${}", params.len()));
    }
    if cols.contains("notify_email") {
        params.push(&profile.notify_email);
        set_clauses.push(format!("notify_email = ${}", params.len()));
    }
    if cols.contains("notify_sound") {
        params.push(&profile.notify_sound);
        set_clauses.push(format!("notify_sound = ${}", params.len()));
    }
    if cols.contains("notify_security") {
        params.push(&profile.notify_security);
        set_clauses.push(format!("notify_security = ${}", params.len()));
    }

    if !set_clauses.is_empty() {
        params.push(&clean_email);
        let update_sql = format!(
            "UPDATE users SET {} WHERE LOWER(email) = LOWER(${})",
            set_clauses.join(", "),
            params.len()
        );
        let _ = client.execute(&update_sql, &params[..]).await;
    }

    // 2. Persist extended profile preferences in server_notes as bulletproof backup
    let prefs_json = serde_json::json!({
        "username": clean_username,
        "avatar": avatar,
        "bio": clean_bio,
        "notify_email": profile.notify_email,
        "notify_sound": profile.notify_sound,
        "notify_security": profile.notify_security,
    }).to_string();

    let existing_note = client
        .query_opt(
            "SELECT id FROM server_notes WHERE LOWER(user_email) = LOWER($1) AND title = '__profile_prefs__' LIMIT 1;",
            &[&clean_email],
        )
        .await
        .ok()
        .flatten();

    if let Some(row) = existing_note {
        let note_id: i64 = row.get(0);
        let _ = client
            .execute(
                "UPDATE server_notes SET content = $1 WHERE id = $2;",
                &[&prefs_json, &note_id],
            )
            .await;
    } else {
        let _ = client
            .execute(
                "INSERT INTO server_notes (user_email, title, folder, content, note_type, status) VALUES ($1, '__profile_prefs__', 'system', $2, 'system', 'active');",
                &[&clean_email, &prefs_json],
            )
            .await;
    }

    // Reuse the exact same client connection without reconnecting!
    fetch_profile_with_client(&client, &clean_email).await
}
