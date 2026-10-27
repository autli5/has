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
