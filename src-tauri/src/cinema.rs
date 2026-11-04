use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CinemaPlayback {
    pub title_id: String,
    pub title_name: String,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub season: u32,
    pub episode: u32,
    pub progress_seconds: f64,
    pub duration_seconds: f64,
    pub last_watched: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CinemaState {
    pub bookmarks: Vec<String>,
    pub history: Vec<CinemaPlayback>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CinemaConfig {
    pub tmdb_api_key: Option<String>,
}

fn get_storage_file_path(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    if !data_dir.exists() {
        let _ = fs::create_dir_all(&data_dir);
    }
    data_dir.join("cinema_state.json")
}

// Built-in verified TMDB API key used as fallback in production release builds (when .env is absent)
pub const DEFAULT_TMDB_API_KEY: &str = "31a7712e584811e0751d15b653efbe2f";

#[tauri::command]
pub fn get_cinema_config() -> CinemaConfig {
    crate::auth::load_env();
    let key = std::env::var("TMDB_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_TMDB_API_KEY.to_string());

    CinemaConfig { tmdb_api_key: Some(key) }
}

pub fn read_local_cinema_state(app: &AppHandle) -> CinemaState {
    let path = get_storage_file_path(app);
    if !path.exists() {
        return CinemaState::default();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str::<CinemaState>(&content).unwrap_or_default(),
        Err(_) => CinemaState::default(),
    }
}

pub fn write_local_cinema_state(app: &AppHandle, state: &CinemaState) -> Result<(), String> {
    let path = get_storage_file_path(app);
    let json = serde_json::to_string_pretty(state).map_err(|e| format!("Ошибка сериализации данных: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Не удалось сохранить локальный файл кинотеатра: {}", e))?;
    Ok(())
}

pub async fn fetch_remote_cinema_state(user_email: &str) -> Option<CinemaState> {
    let email = user_email.trim().to_lowercase();
    if email.is_empty() {
        return None;
    }
    let config = crate::auth::get_db_config();
    let client = crate::auth::connect_to_db(&config).await.ok()?;
    let row = client
        .query_opt(
            "SELECT content FROM server_notes WHERE LOWER(user_email) = LOWER($1) AND title = '__cinema_state__' ORDER BY id DESC LIMIT 1",
            &[&email],
        )
        .await
        .ok()?;

    if let Some(row) = row {
        let content: String = row.get(0);
        serde_json::from_str::<CinemaState>(&content).ok()
    } else {
        None
    }
}

pub async fn save_remote_cinema_state(user_email: &str, state: &CinemaState) -> Result<(), String> {
    let email = user_email.trim().to_lowercase();
    if email.is_empty() {
        return Ok(());
    }
    let json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    let config = crate::auth::get_db_config();
    let client = crate::auth::connect_to_db(&config)
        .await
        .map_err(|e| format!("Не удалось подключиться к базе данных: {}", e))?;

    let existing = client
        .query_opt(
            "SELECT id FROM server_notes WHERE LOWER(user_email) = LOWER($1) AND title = '__cinema_state__' LIMIT 1",
            &[&email],
        )
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = existing {
        let id: i64 = row.get(0);
        client
            .execute(
                "UPDATE server_notes SET content = $1 WHERE id = $2",
                &[&json, &id],
            )
            .await
            .map_err(|e| e.to_string())?;
    } else {
        client
            .execute(
                "INSERT INTO server_notes (user_email, title, folder, content, note_type, status) VALUES ($1, '__cinema_state__', 'system', $2, 'system', 'active')",
                &[&email, &json],
            )
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn merge_cinema_states(local: CinemaState, remote: Option<CinemaState>) -> CinemaState {
    let remote = match remote {
        Some(r) => r,
        None => return local,
    };

    // 1. Merge bookmarks: union preserving unique items
    let mut bookmarks = local.bookmarks;
    for bm in remote.bookmarks {
        if !bookmarks.contains(&bm) {
            bookmarks.push(bm);
        }
    }

    // 2. Merge history: key = (title_id, season, episode)
    let mut history_map: std::collections::HashMap<(String, u32, u32), CinemaPlayback> =
        std::collections::HashMap::new();

    for item in remote.history {
        history_map.insert((item.title_id.clone(), item.season, item.episode), item);
    }

    for item in local.history {
        let key = (item.title_id.clone(), item.season, item.episode);
        if let Some(existing) = history_map.get_mut(&key) {
            if item.last_watched >= existing.last_watched || item.progress_seconds > existing.progress_seconds {
                *existing = item;
            }
        } else {
            history_map.insert(key, item);
        }
    }

    let mut merged_history: Vec<CinemaPlayback> = history_map.into_values().collect();
    merged_history.sort_by(|a, b| b.last_watched.cmp(&a.last_watched));
    if merged_history.len() > 50 {
        merged_history.truncate(50);
    }

    CinemaState {
        bookmarks,
        history: merged_history,
    }
}

#[tauri::command]
pub async fn get_cinema_state(app: AppHandle, user_email: Option<String>) -> Result<CinemaState, String> {
    let local_state = read_local_cinema_state(&app);
    if let Some(email) = user_email {
        let email_clean = email.trim().to_lowercase();
        if !email_clean.is_empty()
            && let Some(remote_state) = fetch_remote_cinema_state(&email_clean).await {
                let merged = merge_cinema_states(local_state, Some(remote_state));
                let _ = write_local_cinema_state(&app, &merged);
                let email_for_task = email_clean.clone();
                let merged_for_task = merged.clone();
                tokio::spawn(async move {
                    let _ = save_remote_cinema_state(&email_for_task, &merged_for_task).await;
                });
                return Ok(merged);
            }
    }
    Ok(local_state)
}

#[tauri::command]
pub async fn save_cinema_state(
    app: AppHandle,
    state: CinemaState,
    user_email: Option<String>,
) -> Result<bool, String> {
    write_local_cinema_state(&app, &state)?;
    if let Some(email) = user_email {
        let email_clean = email.trim().to_lowercase();
        if !email_clean.is_empty() {
            let state_to_save = state.clone();
            tokio::spawn(async move {
                let _ = save_remote_cinema_state(&email_clean, &state_to_save).await;
            });
        }
    }
    Ok(true)
}

#[tauri::command]
pub async fn update_cinema_progress(
    app: AppHandle,
    item: CinemaPlayback,
    user_email: Option<String>,
) -> Result<CinemaState, String> {
    let mut state = read_local_cinema_state(&app);
    
    // Remove older entry for the same title/season/episode if exists
    state.history.retain(|h| !(h.title_id == item.title_id && h.season == item.season && h.episode == item.episode));
    // Prepend latest entry so it's top of continue watching
    state.history.insert(0, item);
    
    // Keep max 50 items in local history
    if state.history.len() > 50 {
        state.history.truncate(50);
    }

    let _ = write_local_cinema_state(&app, &state);

    if let Some(email) = user_email {
        let email_clean = email.trim().to_lowercase();
        if !email_clean.is_empty() {
            let state_to_save = state.clone();
            tokio::spawn(async move {
                let _ = save_remote_cinema_state(&email_clean, &state_to_save).await;
            });
        }
    }

    Ok(state)
}

#[tauri::command]
pub async fn remove_cinema_history_item(
    app: AppHandle,
    title_id: String,
    season: u32,
    episode: u32,
    user_email: Option<String>,
) -> Result<CinemaState, String> {
    let mut state = read_local_cinema_state(&app);
    state.history.retain(|h| !(h.title_id == title_id && h.season == season && h.episode == episode));
    let _ = write_local_cinema_state(&app, &state);

    if let Some(email) = user_email {
        let email_clean = email.trim().to_lowercase();
        if !email_clean.is_empty() {
            let state_to_save = state.clone();
            tokio::spawn(async move {
                let _ = save_remote_cinema_state(&email_clean, &state_to_save).await;
            });
        }
    }

    Ok(state)
}

#[tauri::command]
pub async fn clear_cinema_history(
    app: AppHandle,
    user_email: Option<String>,
) -> Result<CinemaState, String> {
    let mut state = read_local_cinema_state(&app);
    state.history.clear();
    let _ = write_local_cinema_state(&app, &state);

    if let Some(email) = user_email {
        let email_clean = email.trim().to_lowercase();
        if !email_clean.is_empty() {
            let state_to_save = state.clone();
            tokio::spawn(async move {
                let _ = save_remote_cinema_state(&email_clean, &state_to_save).await;
            });
        }
    }

    Ok(state)
}

#[tauri::command]
pub async fn toggle_cinema_bookmark(
    app: AppHandle,
    title_id: String,
    user_email: Option<String>,
) -> Result<CinemaState, String> {
    let mut state = read_local_cinema_state(&app);
    if let Some(pos) = state.bookmarks.iter().position(|id| id == &title_id) {
        state.bookmarks.remove(pos);
    } else {
        state.bookmarks.push(title_id);
    }

    let _ = write_local_cinema_state(&app, &state);

    if let Some(email) = user_email {
        let email_clean = email.trim().to_lowercase();
        if !email_clean.is_empty() {
            let state_to_save = state.clone();
            tokio::spawn(async move {
                let _ = save_remote_cinema_state(&email_clean, &state_to_save).await;
            });
        }
    }

    Ok(state)
}

// Universal TMDB proxy in Rust that bypasses Russian IP / Cloudflare blocks and CORS
#[tauri::command]
pub async fn tmdb_query(endpoint: String) -> Result<serde_json::Value, String> {
    crate::auth::load_env();
    let api_key = std::env::var("TMDB_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_TMDB_API_KEY.to_string());

    let unblocked_addrs = [
        "108.156.107.41:443".parse().unwrap(),
        "108.156.107.114:443".parse().unwrap(),
        "18.67.111.45:443".parse().unwrap(),
        "13.225.103.55:443".parse().unwrap(),
        "99.84.191.109:443".parse().unwrap(),
    ];

    let client = reqwest::Client::builder()
        .resolve_to_addrs("api.themoviedb.org", &unblocked_addrs)
        .resolve_to_addrs("api.tmdb.org", &unblocked_addrs)
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Ошибка создания HTTP клиента: {}", e))?;

    let is_bearer = api_key.starts_with("ey");
    let query_param = if is_bearer {
        String::new()
    } else if endpoint.contains('?') {
        format!("&api_key={}", api_key)
    } else {
        format!("?api_key={}", api_key)
    };

    // Fast working TMDB endpoints
    let mirrors = [
        "https://api.themoviedb.org/3",
        "https://api.tmdb.org/3",
    ];

    let mut last_err = String::from("Не удалось получить ответ от серверов TMDB");

    for base in mirrors {
        let url = format!("{}{}{}", base, endpoint, query_param);
        let mut req = client.get(&url);
        if is_bearer {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    match resp.json::<serde_json::Value>().await {
                        Ok(val) => return Ok(val),
                        Err(e) => last_err = format!("Ошибка разбора ответа от {}: {}", base, e),
                    }
                } else {
                    last_err = format!("Сервер {} вернул код: {}", base, status);
                }
            }
            Err(e) => {
                last_err = format!("Ошибка сети к {}: {}", base, e);
            }
        }
    }

    Err(last_err)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RussianMediaInfo {
    pub kp_id: Option<u64>,
    pub imdb_id: Option<String>,
    pub iframe_url: Option<String>,
    pub russian_title: Option<String>,
}

fn parse_u64_or_str(v: Option<&serde_json::Value>) -> Option<u64> {
    v.and_then(|val| {
        val.as_u64()
            .or_else(|| val.as_str().and_then(|s| s.parse::<u64>().ok()))
    })
}

fn parse_str(v: Option<&serde_json::Value>) -> Option<String> {
    v.and_then(|val| val.as_str().map(|s| s.to_string()))
}

// Queries Alloha / Kinopoisk and TMDB external IDs to provide direct Russian dubbing streams
#[tauri::command]
pub async fn get_russian_media_info(
    tmdb_id: Option<u64>,
    is_tv: bool,
    title: Option<String>,
) -> Result<RussianMediaInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let mut info = RussianMediaInfo::default();

    // 1. Try Alloha API by TMDB ID
    if let Some(tmdb) = tmdb_id {
        let tmdb_str = tmdb.to_string();
        let query_params = [
            ("token", "45e20a5f584becf7a64dffb7174ddf"),
            ("tmdb", tmdb_str.as_str()),
        ];
        if let Ok(resp) = client.get("https://api.apbugall.org/").query(&query_params).send().await
            && resp.status().is_success()
                && let Ok(json) = resp.json::<serde_json::Value>().await {
                    let is_ok = json.get("status").and_then(|s| s.as_str()) == Some("success");
                    if is_ok {
                        let data_opt = json.get("data");
                        let item_opt = if let Some(arr) = data_opt.and_then(|d| d.as_array()) {
                            arr.first()
                        } else {
                            data_opt
                        };

                        if let Some(data) = item_opt {
                            info.kp_id = parse_u64_or_str(data.get("id_kp"));
                            info.imdb_id = parse_str(data.get("id_imdb"));
                            info.iframe_url = parse_str(data.get("iframe"));
                            info.russian_title = parse_str(data.get("name"));
                            if info.kp_id.is_some() || info.iframe_url.is_some() {
                                return Ok(info);
                            }
                        }
                    }
                }
    }

    // 2. Try Alloha API by Russian / Original title if TMDB didn't return a match
    if let Some(ref t) = title {
        let clean_title = t.trim();
        if !clean_title.is_empty() {
            let query_params = [
                ("token", "45e20a5f584becf7a64dffb7174ddf"),
                ("name", clean_title),
            ];
            if let Ok(resp) = client.get("https://api.apbugall.org/").query(&query_params).send().await
                && resp.status().is_success()
                    && let Ok(json) = resp.json::<serde_json::Value>().await {
                        let is_ok = json.get("status").and_then(|s| s.as_str()) == Some("success");
                        if is_ok {
                            let data_opt = json.get("data");
                            let item_opt = if let Some(arr) = data_opt.and_then(|d| d.as_array()) {
                                arr.first()
                            } else {
                                data_opt
                            };

                            if let Some(data) = item_opt {
                                info.kp_id = parse_u64_or_str(data.get("id_kp"));
                                info.imdb_id = parse_str(data.get("id_imdb"));
                                info.iframe_url = parse_str(data.get("iframe"));
                                info.russian_title = parse_str(data.get("name"));
                                if info.kp_id.is_some() || info.iframe_url.is_some() {
                                    return Ok(info);
                                }
                            }
                        }
                    }
        }
    }

    // 3. Fallback: Query TMDB for external IMDB ID (for Embess & Smotrim IMDB routing)
    if let Some(tmdb) = tmdb_id {
        let ep = if is_tv {
            format!("/tv/{}/external_ids", tmdb)
        } else {
            format!("/movie/{}/external_ids", tmdb)
        };
        if let Ok(val) = tmdb_query(ep).await
            && let Some(imdb) = val.get("imdb_id").and_then(|v| v.as_str()) {
                info.imdb_id = Some(imdb.to_string());
            }
    }

    Ok(info)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayableCheckItem {
    pub tmdb_id: u64,
    pub title: String,
    pub original_title: Option<String>,
    pub media_type: String,
    pub vote_count: Option<u32>,
    pub release_year: Option<String>,
}

// Verifies that media items actually have a playable player/stream available on balancers
#[tauri::command]
pub async fn filter_playable_media(items: Vec<PlayableCheckItem>) -> Result<Vec<u64>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_millis(3500))
        .build()
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();

    for item in items {
        let client_clone = client.clone();
        tasks.push(tokio::spawn(async move {
            let tmdb_id = item.tmdb_id;
            let votes = item.vote_count.unwrap_or(0);

            // 1. High-confidence threshold: global titles with 100+ votes on TMDB
            // have confirmed releases and are indexed across VidLink, VidSrc, and major CDNs.
            if votes >= 100 {
                return Some(tmdb_id);
            }

            // 2. For items with < 100 votes (including Russian titles and indie releases):
            // Check Alloha balancer API:
            let tmdb_str = tmdb_id.to_string();
            let alloha_res = client_clone
                .get("https://api.apbugall.org/")
                .query(&[
                    ("token", "45e20a5f584becf7a64dffb7174ddf"),
                    ("tmdb", tmdb_str.as_str()),
                ])
                .send()
                .await;

            if let Ok(resp) = alloha_res
                && resp.status().is_success()
                    && let Ok(json) = resp.json::<serde_json::Value>().await
                        && json.get("status").and_then(|s| s.as_str()) == Some("success") {
                            let has_data = json.get("data").is_some_and(|d| {
                                if let Some(arr) = d.as_array() {
                                    !arr.is_empty()
                                } else {
                                    d.is_object()
                                }
                            });
                            if has_data {
                                return Some(tmdb_id);
                            }
                        }

            // 3. Check Kodik balancer API:
            let clean_title = item.title.trim();
            if !clean_title.is_empty() {
                let kodik_res = client_clone
                    .get("https://kodik-api.com/search")
                    .query(&[
                        ("token", "41dd95f84c21719b09d6c71182237a25"),
                        ("title", clean_title),
                    ])
                    .send()
                    .await;

                if let Ok(resp) = kodik_res
                    && resp.status().is_success()
                        && let Ok(json) = resp.json::<serde_json::Value>().await
                            && let Some(results) = json.get("results").and_then(|r| r.as_array())
                                && !results.is_empty() {
                                    return Some(tmdb_id);
                                }
            }

            // 4. Try title search on Alloha as last check for Russian titles
            if !clean_title.is_empty() {
                let alloha_title_res = client_clone
                    .get("https://api.apbugall.org/")
                    .query(&[
                        ("token", "45e20a5f584becf7a64dffb7174ddf"),
                        ("name", clean_title),
                    ])
                    .send()
                    .await;

                if let Ok(resp) = alloha_title_res
                    && resp.status().is_success()
                        && let Ok(json) = resp.json::<serde_json::Value>().await
                            && json.get("status").and_then(|s| s.as_str()) == Some("success") {
                                return Some(tmdb_id);
                            }
            }

            // If neither Alloha nor Kodik has it, and votes < 100, this title has NO working player!
            None
        }));
    }

    let mut playable_ids = Vec::new();
    for task in tasks {
        if let Ok(Some(id)) = task.await {
            playable_ids.push(id);
        }
    }

    Ok(playable_ids)
}

// ---------------------------------------------------------
// Watch Together (Совместный просмотр) Room Sync System
// ---------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomParticipant {
    pub user_email: String,
    pub user_name: String,
    pub is_host: bool,
    pub last_seen_epoch: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchRoom {
    pub room_code: String,
    pub host_email: String,
    pub host_name: String,
    pub media_id: String,
    pub media_title: String,
    pub media_type: String,
    pub poster_path: Option<String>,
    pub season: u32,
    pub episode: u32,
    pub current_time_seconds: f64,
    pub is_playing: bool,
    pub updated_by: String,
    pub updated_at_epoch: i64,
    pub participants: Vec<RoomParticipant>,
}

fn get_now_epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn generate_room_code() -> String {
    use std::hash::{BuildHasher, Hasher};
    let hasher = std::collections::hash_map::RandomState::new().build_hasher().finish();
    format!("{:06}", (hasher % 900_000) + 100_000)
}

async fn ensure_cinema_rooms_table(client: &tokio_postgres::Client) {
    let ddl = r#"
        CREATE TABLE IF NOT EXISTS cinema_rooms (
            room_code VARCHAR(16) PRIMARY KEY,
            host_email VARCHAR(255) NOT NULL,
            host_name VARCHAR(255) NOT NULL,
            media_id VARCHAR(255) NOT NULL,
            media_title TEXT NOT NULL,
            media_type VARCHAR(32) NOT NULL DEFAULT 'movie',
            poster_path TEXT,
            season INT NOT NULL DEFAULT 1,
            episode INT NOT NULL DEFAULT 1,
            current_time_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
            is_playing BOOLEAN NOT NULL DEFAULT false,
            updated_by VARCHAR(255) NOT NULL,
            updated_at_epoch BIGINT NOT NULL,
            participants_json TEXT NOT NULL DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    "#;
    let _ = client.batch_execute(ddl).await;
}

pub async fn db_save_room(room: &WatchRoom) -> Result<(), String> {
    let config = crate::auth::get_db_config();
    let client = crate::auth::connect_to_db(&config)
        .await
        .map_err(|e| format!("Ошибка подключения к БД комнат: {}", e))?;

    ensure_cinema_rooms_table(&client).await;

    let participants_json = serde_json::to_string(&room.participants).unwrap_or_else(|_| "[]".to_string());
    let season_i32 = room.season as i32;
    let episode_i32 = room.episode as i32;

    let res = client.execute(
        r#"
        INSERT INTO cinema_rooms (
            room_code, host_email, host_name, media_id, media_title, media_type,
            poster_path, season, episode, current_time_seconds, is_playing,
            updated_by, updated_at_epoch, participants_json, last_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        ON CONFLICT (room_code) DO UPDATE SET
            media_id = EXCLUDED.media_id,
            media_title = EXCLUDED.media_title,
            media_type = EXCLUDED.media_type,
            poster_path = EXCLUDED.poster_path,
            season = EXCLUDED.season,
            episode = EXCLUDED.episode,
            current_time_seconds = EXCLUDED.current_time_seconds,
            is_playing = EXCLUDED.is_playing,
            updated_by = EXCLUDED.updated_by,
            updated_at_epoch = EXCLUDED.updated_at_epoch,
            participants_json = EXCLUDED.participants_json,
            last_active = CURRENT_TIMESTAMP;
        "#,
        &[
            &room.room_code,
            &room.host_email,
            &room.host_name,
            &room.media_id,
            &room.media_title,
            &room.media_type,
            &room.poster_path,
            &season_i32,
            &episode_i32,
            &room.current_time_seconds,
            &room.is_playing,
            &room.updated_by,
            &room.updated_at_epoch,
            &participants_json,
        ],
    ).await;

    if res.is_err() {
        // Fallback into server_notes table
        let title = format!("__cinema_room_{}__", room.room_code);
        let room_json = serde_json::to_string(room).map_err(|e| e.to_string())?;
        let _ = client.execute(
            "DELETE FROM server_notes WHERE title = $1;",
            &[&title],
        ).await;
        client.execute(
            "INSERT INTO server_notes (user_email, title, content) VALUES ($1, $2, $3);",
            &[&room.host_email, &title, &room_json],
        ).await.map_err(|e| format!("Не удалось сохранить комнату: {}", e))?;
    }

    Ok(())
}

pub async fn db_get_room(room_code: &str) -> Result<Option<WatchRoom>, String> {
    let clean_code = room_code.trim();
    if clean_code.is_empty() {
        return Ok(None);
    }

    let config = crate::auth::get_db_config();
    let client = crate::auth::connect_to_db(&config)
        .await
        .map_err(|e| format!("Ошибка подключения к БД: {}", e))?;

    ensure_cinema_rooms_table(&client).await;

    let row_res = client.query_opt(
        r#"
        SELECT room_code, host_email, host_name, media_id, media_title, media_type,
               poster_path, season, episode, current_time_seconds, is_playing,
               updated_by, updated_at_epoch, participants_json
        FROM cinema_rooms
        WHERE room_code = $1;
        "#,
        &[&clean_code],
    ).await;

    if let Ok(Some(row)) = row_res {
        let r_code: String = row.get(0);
        let host_email: String = row.get(1);
        let host_name: String = row.get(2);
        let media_id: String = row.get(3);
        let media_title: String = row.get(4);
        let media_type: String = row.get(5);
        let poster_path: Option<String> = row.get(6);
        let season: i32 = row.get(7);
        let episode: i32 = row.get(8);
        let current_time_seconds: f64 = row.get(9);
        let is_playing: bool = row.get(10);
        let updated_by: String = row.get(11);
        let updated_at_epoch: i64 = row.get(12);
        let participants_raw: String = row.get(13);
        let participants: Vec<RoomParticipant> = serde_json::from_str(&participants_raw).unwrap_or_default();

        return Ok(Some(WatchRoom {
            room_code: r_code,
            host_email,
            host_name,
            media_id,
            media_title,
            media_type,
            poster_path,
            season: season.max(1) as u32,
            episode: episode.max(1) as u32,
            current_time_seconds,
            is_playing,
            updated_by,
            updated_at_epoch,
            participants,
        }));
    }

    // Fallback: check server_notes
    let title = format!("__cinema_room_{}__", clean_code);
    if let Ok(Some(row)) = client.query_opt(
        "SELECT content FROM server_notes WHERE title = $1 ORDER BY id DESC LIMIT 1;",
        &[&title],
    ).await {
        let content: String = row.get(0);
        if let Ok(room) = serde_json::from_str::<WatchRoom>(&content) {
            return Ok(Some(room));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn create_cinema_room(
    user_email: String,
    user_name: String,
    media_id: String,
    media_title: String,
    media_type: String,
    poster_path: Option<String>,
    season: u32,
    episode: u32,
    current_time_seconds: f64,
    is_playing: bool,
) -> Result<WatchRoom, String> {
    let now = get_now_epoch_ms();
    let room_code = generate_room_code();

    let participant = RoomParticipant {
        user_email: user_email.clone(),
        user_name: user_name.clone(),
        is_host: true,
        last_seen_epoch: now,
    };

    let room = WatchRoom {
        room_code: room_code.clone(),
        host_email: user_email.clone(),
        host_name: user_name.clone(),
        media_id,
        media_title,
        media_type,
        poster_path,
        season,
        episode,
        current_time_seconds,
        is_playing,
        updated_by: user_name,
        updated_at_epoch: now,
        participants: vec![participant],
    };

    db_save_room(&room).await?;
    Ok(room)
}

#[tauri::command]
pub async fn join_cinema_room(
    room_code: String,
    user_email: String,
    user_name: String,
) -> Result<WatchRoom, String> {
    let clean_code = room_code.trim().to_string();
    let mut room = db_get_room(&clean_code)
        .await?
        .ok_or_else(|| format!("Комната с кодом {} не найдена", clean_code))?;

    let now = get_now_epoch_ms();
    let user_email_clean = user_email.trim().to_lowercase();

    // Check if participant already in room
    let mut found = false;
    for p in &mut room.participants {
        if p.user_email.trim().to_lowercase() == user_email_clean {
            p.user_name = user_name.clone();
            p.last_seen_epoch = now;
            found = true;
            break;
        }
    }

    if !found {
        room.participants.push(RoomParticipant {
            user_email: user_email.clone(),
            user_name,
            is_host: false,
            last_seen_epoch: now,
        });
    }

    db_save_room(&room).await?;
    Ok(room)
}

#[tauri::command]
pub async fn get_cinema_room(
    room_code: String,
    user_email: String,
) -> Result<Option<WatchRoom>, String> {
    let clean_code = room_code.trim();
    if clean_code.is_empty() {
        return Ok(None);
    }

    let mut room = match db_get_room(clean_code).await? {
        Some(r) => r,
        None => return Ok(None),
    };

    let now = get_now_epoch_ms();
    let user_email_clean = user_email.trim().to_lowercase();

    // Update heartbeat for current user
    let mut updated_participant = false;
    for p in &mut room.participants {
        if !user_email_clean.is_empty() && p.user_email.trim().to_lowercase() == user_email_clean {
            p.last_seen_epoch = now;
            updated_participant = true;
        }
    }

    // Filter stale participants (> 120s inactive)
    room.participants.retain(|p| (now - p.last_seen_epoch) < 120_000);

    if updated_participant {
        let _ = db_save_room(&room).await;
    }

    Ok(Some(room))
}

#[tauri::command]
pub async fn sync_cinema_room(
    room_code: String,
    user_email: String,
    user_name: String,
    current_time_seconds: Option<f64>,
    is_playing: Option<bool>,
    season: Option<u32>,
    episode: Option<u32>,
) -> Result<WatchRoom, String> {
    let clean_code = room_code.trim().to_string();
    let mut room = db_get_room(&clean_code)
        .await?
        .ok_or_else(|| format!("Комната {} не найдена", clean_code))?;

    let now = get_now_epoch_ms();

    if let Some(t) = current_time_seconds {
        room.current_time_seconds = t;
    }
    if let Some(play) = is_playing {
        room.is_playing = play;
    }
    if let Some(s) = season {
        room.season = s;
    }
    if let Some(ep) = episode {
        room.episode = ep;
    }

    room.updated_by = if !user_name.trim().is_empty() {
        user_name.clone()
    } else {
        user_email.clone()
    };
    room.updated_at_epoch = now;

    // Refresh heartbeat
    let user_email_clean = user_email.trim().to_lowercase();
    for p in &mut room.participants {
        if p.user_email.trim().to_lowercase() == user_email_clean {
            p.last_seen_epoch = now;
            if !user_name.trim().is_empty() {
                p.user_name = user_name.clone();
            }
        }
    }

    db_save_room(&room).await?;
    Ok(room)
}

#[tauri::command]
pub async fn leave_cinema_room(
    room_code: String,
    user_email: String,
) -> Result<bool, String> {
    let clean_code = room_code.trim().to_string();
    let mut room = match db_get_room(&clean_code).await? {
        Some(r) => r,
        None => return Ok(true),
    };

    let user_email_clean = user_email.trim().to_lowercase();
    room.participants.retain(|p| p.user_email.trim().to_lowercase() != user_email_clean);

    if room.participants.is_empty() {
        // Room is empty - clean up
        let config = crate::auth::get_db_config();
        if let Ok(client) = crate::auth::connect_to_db(&config).await {
            let _ = client.execute("DELETE FROM cinema_rooms WHERE room_code = $1;", &[&clean_code]).await;
            let title = format!("__cinema_room_{}__", clean_code);
            let _ = client.execute("DELETE FROM server_notes WHERE title = $1;", &[&title]).await;
        }
    } else {
        // Transfer host if host left
        if room.host_email.trim().to_lowercase() == user_email_clean && !room.participants.is_empty() {
            room.participants[0].is_host = true;
            room.host_email = room.participants[0].user_email.clone();
            room.host_name = room.participants[0].user_name.clone();
        }
        let _ = db_save_room(&room).await;
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_cinema_states() {
        let local = CinemaState {
            bookmarks: vec!["movie-1".to_string(), "movie-2".to_string()],
            history: vec![CinemaPlayback {
                title_id: "movie-1".to_string(),
                title_name: "Movie 1".to_string(),
                poster_path: None,
                backdrop_path: None,
                season: 1,
                episode: 1,
                progress_seconds: 1500.0,
                duration_seconds: 3600.0,
                last_watched: "2026-10-27T12:00:00Z".to_string(),
            }],
        };

        let remote = CinemaState {
            bookmarks: vec!["movie-2".to_string(), "movie-3".to_string()],
            history: vec![
                CinemaPlayback {
                    title_id: "movie-1".to_string(),
                    title_name: "Movie 1".to_string(),
                    poster_path: None,
                    backdrop_path: None,
                    season: 1,
                    episode: 1,
                    progress_seconds: 2400.0,
                    duration_seconds: 3600.0,
                    last_watched: "2026-10-27T13:00:00Z".to_string(),
                },
                CinemaPlayback {
                    title_id: "tv-1".to_string(),
                    title_name: "TV Show 1".to_string(),
                    poster_path: None,
                    backdrop_path: None,
                    season: 1,
                    episode: 2,
                    progress_seconds: 300.0,
                    duration_seconds: 1800.0,
                    last_watched: "2026-10-27T11:00:00Z".to_string(),
                },
            ],
        };

        let merged = merge_cinema_states(local, Some(remote));
        assert_eq!(merged.bookmarks.len(), 3);
        assert!(merged.bookmarks.contains(&"movie-1".to_string()));
        assert!(merged.bookmarks.contains(&"movie-2".to_string()));
        assert!(merged.bookmarks.contains(&"movie-3".to_string()));

        assert_eq!(merged.history.len(), 2);
        // movie-1 from remote should win because it has newer timestamp and more progress
        let m1 = merged.history.iter().find(|h| h.title_id == "movie-1").unwrap();
        assert_eq!(m1.progress_seconds, 2400.0);
        assert_eq!(m1.last_watched, "2026-10-27T13:00:00Z");
    }

    #[tokio::test]
    async fn test_db_cinema_remote_sync() {
        let test_email = "test_sync_cinema@example.com";
        let state = CinemaState {
            bookmarks: vec!["synced-title-42".to_string()],
            history: vec![CinemaPlayback {
                title_id: "synced-title-42".to_string(),
                title_name: "Synced Title".to_string(),
                poster_path: None,
                backdrop_path: None,
                season: 1,
                episode: 1,
                progress_seconds: 999.0,
                duration_seconds: 1800.0,
                last_watched: "2026-10-27T15:00:00Z".to_string(),
            }],
        };

        let save_res = save_remote_cinema_state(test_email, &state).await;
        println!("save_remote_cinema_state result: {:?}", save_res);
        assert!(save_res.is_ok());

        let fetched = fetch_remote_cinema_state(test_email).await;
        println!("fetch_remote_cinema_state result: {:?}", fetched);
        assert!(fetched.is_some());
        let fetched_state = fetched.unwrap();
        assert_eq!(fetched_state.bookmarks, vec!["synced-title-42".to_string()]);
        assert_eq!(fetched_state.history[0].progress_seconds, 999.0);

        // Clean up test record
        let config = crate::auth::get_db_config();
        if let Ok(client) = crate::auth::connect_to_db(&config).await {
            let _ = client.execute("DELETE FROM server_notes WHERE LOWER(user_email) = LOWER($1) AND title = '__cinema_state__'", &[&test_email]).await;
        }
    }

    #[tokio::test]
    async fn test_tmdb_query() {
        let res = tmdb_query("/movie/157336?language=ru-RU".to_string()).await;
        println!("Test TMDB Query result: {:?}", res);
        assert!(res.is_ok(), "Expected TMDB query to succeed: {:?}", res);
    }
}
