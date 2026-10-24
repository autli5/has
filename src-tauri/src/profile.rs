use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use crate::auth::{connect_to_db, get_db_config};

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

#[tauri::command]
pub async fn get_user_profile(user_email: String) -> Result<UserProfileDto, String> {
    let clean_email = user_email.trim().to_lowercase();
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    
    // Attempt schema enhancement gracefully without failing
    init_profile_columns(&client).await;

    let cols = get_existing_user_columns(&client).await;

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

    Ok(UserProfileDto {
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
    })
}

#[tauri::command]
pub async fn save_user_profile(
    user_email: String,
    profile: UserProfileSaveDto,
) -> Result<UserProfileDto, String> {
    let clean_email = user_email.trim().to_lowercase();
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    
    // Attempt schema enhancement gracefully
    init_profile_columns(&client).await;

    let cols = get_existing_user_columns(&client).await;

    let clean_username = profile.username.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let clean_bio = profile.bio.as_deref().map(|s| s.trim());
    let avatar = profile.avatar.filter(|s| !s.trim().is_empty());

    if cols.contains("username") {
        let _ = client
            .execute("UPDATE users SET username = $1 WHERE LOWER(email) = LOWER($2);", &[&clean_username, &clean_email])
            .await;
    }
    if cols.contains("avatar") {
        let _ = client
            .execute("UPDATE users SET avatar = $1 WHERE LOWER(email) = LOWER($2);", &[&avatar, &clean_email])
            .await;
    }
    if cols.contains("bio") {
        let _ = client
            .execute("UPDATE users SET bio = $1 WHERE LOWER(email) = LOWER($2);", &[&clean_bio, &clean_email])
            .await;
    }
    if cols.contains("notify_email") {
        let _ = client
            .execute("UPDATE users SET notify_email = $1 WHERE LOWER(email) = LOWER($2);", &[&profile.notify_email, &clean_email])
            .await;
    }
    if cols.contains("notify_sound") {
        let _ = client
            .execute("UPDATE users SET notify_sound = $1 WHERE LOWER(email) = LOWER($2);", &[&profile.notify_sound, &clean_email])
            .await;
    }
    if cols.contains("notify_security") {
        let _ = client
            .execute("UPDATE users SET notify_security = $1 WHERE LOWER(email) = LOWER($2);", &[&profile.notify_security, &clean_email])
            .await;
    }

    get_user_profile(clean_email).await
}
