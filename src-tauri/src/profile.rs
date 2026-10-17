use serde::{Deserialize, Serialize};
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

pub async fn init_profile_columns(client: &tokio_postgres::Client) -> Result<(), String> {
    let sql = "
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT TRUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_sound BOOLEAN DEFAULT TRUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_security BOOLEAN DEFAULT TRUE;
    ";
    client
        .batch_execute(sql)
        .await
        .map_err(|e| format!("Ошибка миграции колонок профиля: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_user_profile(user_email: String) -> Result<UserProfileDto, String> {
    let clean_email = user_email.trim().to_lowercase();
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_profile_columns(&client).await?;

    let row = client
        .query_opt(
            "SELECT id, email, username, COALESCE(role, 'user'), avatar, bio,
                    COALESCE(notify_email, TRUE),
                    COALESCE(notify_sound, TRUE),
                    COALESCE(notify_security, TRUE),
                    TO_CHAR(COALESCE(created_at, CURRENT_TIMESTAMP), 'YYYY-MM-DD HH24:MI')
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1;",
            &[&clean_email],
        )
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
    init_profile_columns(&client).await?;

    let clean_username = profile.username.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let clean_bio = profile.bio.as_deref().map(|s| s.trim());
    let avatar = profile.avatar.filter(|s| !s.trim().is_empty());

    client
        .execute(
            "UPDATE users
             SET username = $1,
                 avatar = $2,
                 bio = $3,
                 notify_email = $4,
                 notify_sound = $5,
                 notify_security = $6
             WHERE LOWER(email) = LOWER($7);",
            &[
                &clean_username,
                &avatar,
                &clean_bio,
                &profile.notify_email,
                &profile.notify_sound,
                &profile.notify_security,
                &clean_email,
            ],
        )
        .await
        .map_err(|e| format!("Ошибка сохранения профиля: {}", e))?;

    get_user_profile(clean_email).await
}
