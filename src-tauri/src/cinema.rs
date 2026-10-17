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

#[tauri::command]
pub fn get_cinema_state(app: AppHandle) -> Result<CinemaState, String> {
    let path = get_storage_file_path(&app);
    if !path.exists() {
        return Ok(CinemaState::default());
    }

    match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<CinemaState>(&content) {
            Ok(state) => Ok(state),
            Err(e) => {
                eprintln!("Error parsing cinema_state.json: {}", e);
                Ok(CinemaState::default())
            }
        },
        Err(e) => Err(format!("Не удалось прочитать локальный файл истории кинотеатра: {}", e)),
    }
}

#[tauri::command]
pub fn save_cinema_state(app: AppHandle, state: CinemaState) -> Result<bool, String> {
    let path = get_storage_file_path(&app);
    match serde_json::to_string_pretty(&state) {
        Ok(json) => match fs::write(&path, json) {
            Ok(_) => Ok(true),
            Err(e) => Err(format!("Не удалось сохранить локальный файл кинотеатра: {}", e)),
        },
        Err(e) => Err(format!("Ошибка сериализации данных: {}", e)),
    }
}

#[tauri::command]
pub fn update_cinema_progress(
    app: AppHandle,
    item: CinemaPlayback,
) -> Result<CinemaState, String> {
    let mut state = get_cinema_state(app.clone()).unwrap_or_default();
    
    // Remove older entry for the same title/season/episode if exists
    state.history.retain(|h| !(h.title_id == item.title_id && h.season == item.season && h.episode == item.episode));
    // Prepend latest entry so it's top of continue watching
    state.history.insert(0, item);
    
    // Keep max 50 items in local history
    if state.history.len() > 50 {
        state.history.truncate(50);
    }

    let _ = save_cinema_state(app, state.clone());
    Ok(state)
}

#[tauri::command]
pub fn toggle_cinema_bookmark(app: AppHandle, title_id: String) -> Result<CinemaState, String> {
    let mut state = get_cinema_state(app.clone()).unwrap_or_default();
    if let Some(pos) = state.bookmarks.iter().position(|id| id == &title_id) {
        state.bookmarks.remove(pos);
    } else {
        state.bookmarks.push(title_id);
    }

    let _ = save_cinema_state(app, state.clone());
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
        if let Ok(resp) = client.get("https://api.apbugall.org/").query(&query_params).send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
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
    }

    // 2. Try Alloha API by Russian / Original title if TMDB didn't return a match
    if let Some(ref t) = title {
        let clean_title = t.trim();
        if !clean_title.is_empty() {
            let query_params = [
                ("token", "45e20a5f584becf7a64dffb7174ddf"),
                ("name", clean_title),
            ];
            if let Ok(resp) = client.get("https://api.apbugall.org/").query(&query_params).send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
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
        }
    }

    // 3. Fallback: Query TMDB for external IMDB ID (for Embess & Smotrim IMDB routing)
    if let Some(tmdb) = tmdb_id {
        let ep = if is_tv {
            format!("/tv/{}/external_ids", tmdb)
        } else {
            format!("/movie/{}/external_ids", tmdb)
        };
        if let Ok(val) = tmdb_query(ep).await {
            if let Some(imdb) = val.get("imdb_id").and_then(|v| v.as_str()) {
                info.imdb_id = Some(imdb.to_string());
            }
        }
    }

    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tmdb_query() {
        let res = tmdb_query("/movie/157336?language=ru-RU".to_string()).await;
        println!("Test TMDB Query result: {:?}", res);
        assert!(res.is_ok(), "Expected TMDB query to succeed: {:?}", res);
    }
}
