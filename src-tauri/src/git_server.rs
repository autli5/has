use serde::{Deserialize, Serialize};
use std::env;
use crate::auth::{connect_to_db, get_db_config};
use crate::storage::resolve_user_folder_name;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepositoryDto {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_private: bool,
    pub owner_email: String,
    pub owner_username: String,
    pub default_branch: String,
    pub clone_url_ssh: String,
    pub clone_url_alt: String,
    pub created_at: String,
    pub updated_at: String,
    pub size_formatted: String,
    pub branches_count: usize,
    pub commits_count: usize,
    pub last_commit_msg: Option<String>,
    pub last_commit_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitTreeItemDto {
    pub name: String,
    pub path: String,
    pub item_type: String, // "blob" (file) or "tree" (folder)
    pub mode: String,
    pub size_formatted: Option<String>,
    pub last_commit_msg: Option<String>,
    pub last_commit_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitCommitDto {
    pub hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitFileContentDto {
    pub name: String,
    pub path: String,
    pub size_bytes: usize,
    pub size_formatted: String,
    pub content: String,
    pub is_binary: bool,
}

fn get_git_base_dir() -> String {
    env::var("SERVER_GIT_PATH").unwrap_or_else(|_| "/www/server/git".to_string())
}

fn get_server_host() -> String {
    env::var("SERVER_HOST").unwrap_or_else(|_| "80.237.77.141".to_string())
}

pub async fn init_git_tables(client: &tokio_postgres::Client) -> Result<(), String> {
    let sql = "
        CREATE TABLE IF NOT EXISTS server_repositories (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            is_private BOOLEAN DEFAULT FALSE,
            owner_email VARCHAR(255) NOT NULL,
            default_branch VARCHAR(100) DEFAULT 'main',
            repo_path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_email, name)
        );
        CREATE INDEX IF NOT EXISTS idx_server_repos_owner ON server_repositories(owner_email);
    ";
    client
        .batch_execute(sql)
        .await
        .map_err(|e| format!("Ошибка создания таблицы репозиториев: {}", e))?;

    // Ensure /www/server/git exists on server
    let base_dir = get_git_base_dir();
    crate::storage::fs_ensure_dir(client, &base_dir).await;

    Ok(())
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

// Executes a command on the Linux server and returns its stdout lines
async fn exec_server_cmd(client: &tokio_postgres::Client, cmd: &str) -> Vec<String> {
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(cmd.as_bytes());
    let sql = format!(
        "CREATE TEMP TABLE IF NOT EXISTS temp_cmd_out (line text);\
         TRUNCATE temp_cmd_out;\
         COPY temp_cmd_out FROM PROGRAM 'python3 -c \"import subprocess, base64, sys; c = base64.b64decode(\\\"{}\\\").decode(\\\"utf-8\\\"); p = subprocess.run(c, shell=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True); print(p.stdout, end=\\\"\\\")\" 2>/dev/null || true';\
         SELECT line FROM temp_cmd_out;",
        b64
    );

    if let Ok(rows) = client.query(&sql, &[]).await {
        rows.into_iter()
            .filter_map(|r| r.try_get::<_, String>(0).ok())
            .collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub async fn list_server_repositories(user_email: String) -> Result<Vec<RepositoryDto>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_git_tables(&client).await?;

    let host = get_server_host();
    let query = "
        SELECT id, name, description, is_private, owner_email, default_branch, repo_path,
               TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI'),
               TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI')
        FROM server_repositories
        WHERE owner_email = $1 OR is_private = FALSE
        ORDER BY updated_at DESC, id DESC;
    ";

    let rows = client
        .query(query, &[&user_email])
        .await
        .map_err(|e| format!("Ошибка получения списка репозиториев: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        let id: i64 = row.get(0);
        let name: String = row.get(1);
        let description: Option<String> = row.get(2);
        let is_private: bool = row.get(3);
        let owner_email: String = row.get(4);
        let default_branch: String = row.get(5);
        let repo_path: String = row.get(6);
        let created_at: String = row.get(7);
        let updated_at: String = row.get(8);

        let owner_username = resolve_user_folder_name(&client, &owner_email).await;
        let clone_url_ssh = format!("ssh://root@{}{}", host, repo_path);
        let clone_url_alt = format!("root@{}:{}", host, repo_path);

        // Fetch repo disk size & commit stats via git
        let size_cmd = format!("du -sb \"{}\" 2>/dev/null | cut -f1", repo_path);
        let size_out = exec_server_cmd(&client, &size_cmd).await;
        let size_bytes: u64 = size_out
            .first()
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(0);

        // Count branches
        let branch_cmd = format!("git --git-dir=\"{}\" branch --list 2>/dev/null | wc -l", repo_path);
        let branch_out = exec_server_cmd(&client, &branch_cmd).await;
        let branches_count: usize = branch_out
            .first()
            .and_then(|s| s.trim().parse::<usize>().ok())
            .unwrap_or(0);

        // Count commits & get last commit message
        let log_cmd = format!(
            "git --git-dir=\"{}\" log -n 1 --pretty=format:\"%s|||%cr\" 2>/dev/null || true",
            repo_path
        );
        let log_out = exec_server_cmd(&client, &log_cmd).await;
        let (last_commit_msg, last_commit_date) = if let Some(first) = log_out.first() {
            let parts: Vec<&str> = first.split("|||").collect();
            if parts.len() >= 2 {
                (Some(parts[0].to_string()), Some(parts[1].to_string()))
            } else if !parts.is_empty() && !parts[0].trim().is_empty() {
                (Some(parts[0].to_string()), None)
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        // Total commits count
        let count_cmd = format!("git --git-dir=\"{}\" rev-list --count HEAD 2>/dev/null || echo 0", repo_path);
        let count_out = exec_server_cmd(&client, &count_cmd).await;
        let commits_count: usize = count_out
            .first()
            .and_then(|s| s.trim().parse::<usize>().ok())
            .unwrap_or(0);

        result.push(RepositoryDto {
            id,
            name,
            description,
            is_private,
            owner_email,
            owner_username,
            default_branch,
            clone_url_ssh,
            clone_url_alt,
            created_at,
            updated_at,
            size_formatted: format_bytes(size_bytes),
            branches_count: if branches_count == 0 && commits_count > 0 { 1 } else { branches_count },
            commits_count,
            last_commit_msg,
            last_commit_date,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_server_repository(
    user_email: String,
    name: String,
    description: Option<String>,
    is_private: bool,
    init_readme: bool,
) -> Result<RepositoryDto, String> {
    let clean_name = name.trim().to_lowercase();
    if clean_name.is_empty() {
        return Err("Имя репозитория не может быть пустым".to_string());
    }

    // Name validation: allow alphanumeric, hyphens, dots and underscores
    if !clean_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err("Имя репозитория может содержать только латинские буквы, цифры, дефис и подчеркивание".to_string());
    }

    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_git_tables(&client).await?;

    let owner_username = resolve_user_folder_name(&client, &user_email).await;
    let base_git_dir = get_git_base_dir();
    let user_git_dir = format!("{}/{}", base_git_dir, owner_username);
    let repo_dir_name = if clean_name.ends_with(".git") {
        clean_name.clone()
    } else {
        format!("{}.git", clean_name)
    };
    let full_repo_path = format!("{}/{}", user_git_dir, repo_dir_name);

    // 1. Ensure user git directory exists
    crate::storage::fs_ensure_dir(&client, &user_git_dir).await;

    // 2. Initialize bare git repository on server
    if init_readme {
        // Create with initial commit containing README.md
        let init_script = format!(
            "rm -rf \"{}\" 2>/dev/null; \
             tmpdir=$(mktemp -d /tmp/git-init-XXXXXX); \
             mkdir -p \"$tmpdir\" && cd \"$tmpdir\" && \
             git init -b main && \
             git config user.name \"{}\" && \
             git config user.email \"{}\" && \
             echo \"# {}\" > README.md && \
             git add README.md && \
             git commit -m \"Initial commit\" && \
             git clone --bare \"$tmpdir\" \"{}\" && \
             rm -rf \"$tmpdir\"; \
             git --git-dir=\"{}\" config core.sharedRepository group 2>/dev/null || true",
            full_repo_path,
            owner_username,
            user_email,
            clean_name,
            full_repo_path,
            full_repo_path
        );
        exec_server_cmd(&client, &init_script).await;
    } else {
        // Pure empty bare repository
        let init_script = format!(
            "mkdir -p \"{}\" && git init --bare -b main \"{}\" && \
             git --git-dir=\"{}\" config core.sharedRepository group 2>/dev/null || true",
            full_repo_path, full_repo_path, full_repo_path
        );
        exec_server_cmd(&client, &init_script).await;
    }

    // 3. Save into PostgreSQL
    let default_branch = "main".to_string();
    let row = client
        .query_one(
            "INSERT INTO server_repositories (name, description, is_private, owner_email, default_branch, repo_path) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI'), TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI');",
            &[&clean_name, &description, &is_private, &user_email, &default_branch, &full_repo_path],
        )
        .await
        .map_err(|e| format!("Ошибка создания репозитория в базе: {}", e))?;

    let id: i64 = row.get(0);
    let created_at: String = row.get(1);
    let updated_at: String = row.get(2);

    let host = get_server_host();
    let clone_url_ssh = format!("ssh://root@{}{}", host, full_repo_path);
    let clone_url_alt = format!("root@{}:{}", host, full_repo_path);

    Ok(RepositoryDto {
        id,
        name: clean_name,
        description,
        is_private,
        owner_email: user_email,
        owner_username,
        default_branch,
        clone_url_ssh,
        clone_url_alt,
        created_at,
        updated_at,
        size_formatted: "12 KB".to_string(),
        branches_count: if init_readme { 1 } else { 0 },
        commits_count: if init_readme { 1 } else { 0 },
        last_commit_msg: if init_readme { Some("Initial commit".to_string()) } else { None },
        last_commit_date: if init_readme { Some("just now".to_string()) } else { None },
    })
}

#[tauri::command]
pub async fn delete_server_repository(user_email: String, repo_id: i64) -> Result<bool, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row_opt = client
        .query_opt(
            "SELECT repo_path, owner_email FROM server_repositories WHERE id = $1;",
            &[&repo_id],
        )
        .await
        .map_err(|e| format!("Ошибка поиска репозитория: {}", e))?;

    let (repo_path, owner): (String, String) = match row_opt {
        Some(r) => (r.get(0), r.get(1)),
        None => return Err("Репозиторий не найден".to_string()),
    };

    if owner != user_email {
        return Err("Вы можете удалять только свои собственные репозитории".to_string());
    }

    // Remove from physical disk
    let rm_cmd = format!("rm -rf \"{}\" 2>/dev/null || true", repo_path);
    exec_server_cmd(&client, &rm_cmd).await;

    // Remove from database
    client
        .execute("DELETE FROM server_repositories WHERE id = $1;", &[&repo_id])
        .await
        .map_err(|e| format!("Ошибка удаления репозитория из базы: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn get_repository_tree(
    user_email: String,
    repo_id: i64,
    branch: Option<String>,
    path: Option<String>,
) -> Result<Vec<GitTreeItemDto>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row = client
        .query_one(
            "SELECT repo_path, default_branch, is_private, owner_email FROM server_repositories WHERE id = $1;",
            &[&repo_id],
        )
        .await
        .map_err(|_| "Репозиторий не найден".to_string())?;

    let repo_path: String = row.get(0);
    let default_branch: String = row.get(1);
    let is_private: bool = row.get(2);
    let owner_email: String = row.get(3);

    if is_private && owner_email != user_email {
        return Err("Доступ к приватному репозиторию запрещен".to_string());
    }

    let target_branch = branch.unwrap_or(default_branch);
    let subpath = path.unwrap_or_default();
    let tree_ref = if subpath.trim().is_empty() {
        target_branch.clone()
    } else {
        format!("{}:{}", target_branch, subpath.trim_matches('/'))
    };

    // git ls-tree -l output format:
    // <mode> SP <type> SP <object> SP <object size> TAB <file>
    let ls_cmd = format!(
        "git --git-dir=\"{}\" ls-tree -l \"{}\" 2>/dev/null || true",
        repo_path, tree_ref
    );
    let lines = exec_server_cmd(&client, &ls_cmd).await;

    let mut items = Vec::new();
    for line in lines {
        // Example: 100644 blob b2129... 1423    README.md
        // Example: 040000 tree 8e5d2... -       src
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 2 {
            continue;
        }
        let file_name = parts[1].trim().to_string();
        let meta_parts: Vec<&str> = parts[0].split_whitespace().collect();
        if meta_parts.len() < 4 {
            continue;
        }

        let mode = meta_parts[0].to_string();
        let item_type = meta_parts[1].to_string(); // "blob" or "tree"
        let size_raw = meta_parts[3];
        let size_formatted = if item_type == "blob" {
            size_raw.parse::<u64>().ok().map(format_bytes)
        } else {
            None
        };

        let full_item_path = if subpath.trim().is_empty() {
            file_name.clone()
        } else {
            format!("{}/{}", subpath.trim_matches('/'), file_name)
        };

        // Get last commit for this file
        let file_commit_cmd = format!(
            "git --git-dir=\"{}\" log -n 1 --pretty=format:\"%s|||%cr\" \"{}\" -- \"{}\" 2>/dev/null || true",
            repo_path, target_branch, full_item_path
        );
        let commit_out = exec_server_cmd(&client, &file_commit_cmd).await;
        let (last_commit_msg, last_commit_date) = if let Some(first) = commit_out.first() {
            let p: Vec<&str> = first.split("|||").collect();
            if p.len() >= 2 {
                (Some(p[0].to_string()), Some(p[1].to_string()))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        items.push(GitTreeItemDto {
            name: file_name,
            path: full_item_path,
            item_type,
            mode,
            size_formatted,
            last_commit_msg,
            last_commit_date,
        });
    }

    // Sort: directories (trees) first, then files (blobs), alphabetically
    items.sort_by(|a, b| {
        if a.item_type == b.item_type {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.item_type == "tree" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(items)
}

#[tauri::command]
pub async fn get_repository_file_content(
    user_email: String,
    repo_id: i64,
    branch: Option<String>,
    file_path: String,
) -> Result<GitFileContentDto, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row = client
        .query_one(
            "SELECT repo_path, default_branch, is_private, owner_email FROM server_repositories WHERE id = $1;",
            &[&repo_id],
        )
        .await
        .map_err(|_| "Репозиторий не найден".to_string())?;

    let repo_path: String = row.get(0);
    let default_branch: String = row.get(1);
    let is_private: bool = row.get(2);
    let owner_email: String = row.get(3);

    if is_private && owner_email != user_email {
        return Err("Доступ к приватному файлу запрещен".to_string());
    }

    let target_branch = branch.unwrap_or(default_branch);
    let clean_path = file_path.trim_matches('/').to_string();
    let object_ref = format!("{}:{}", target_branch, clean_path);

    // Read content via base64 to preserve utf-8 and prevent shell escape issues
    let read_cmd = format!(
        "git --git-dir=\"{}\" show \"{}\" 2>/dev/null | base64 2>/dev/null || true",
        repo_path, object_ref
    );
    let lines = exec_server_cmd(&client, &read_cmd).await;
    let b64_combined = lines.concat();

    use base64::Engine;
    let decoded_bytes = base64::engine::general_purpose::STANDARD
        .decode(b64_combined.trim())
        .map_err(|e| format!("Ошибка декодирования содержимого файла: {}", e))?;

    let size_bytes = decoded_bytes.len();
    let (content, is_binary) = match String::from_utf8(decoded_bytes.clone()) {
        Ok(text) => (text, false),
        Err(_) => ("(Двоичный файл не может быть отображен в текстовом виде)".to_string(), true),
    };

    let name = clean_path.split('/').last().unwrap_or(&clean_path).to_string();

    Ok(GitFileContentDto {
        name,
        path: clean_path,
        size_bytes,
        size_formatted: format_bytes(size_bytes as u64),
        content,
        is_binary,
    })
}

#[tauri::command]
pub async fn get_repository_commits(
    user_email: String,
    repo_id: i64,
    branch: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<GitCommitDto>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row = client
        .query_one(
            "SELECT repo_path, default_branch, is_private, owner_email FROM server_repositories WHERE id = $1;",
            &[&repo_id],
        )
        .await
        .map_err(|_| "Репозиторий не найден".to_string())?;

    let repo_path: String = row.get(0);
    let default_branch: String = row.get(1);
    let is_private: bool = row.get(2);
    let owner_email: String = row.get(3);

    if is_private && owner_email != user_email {
        return Err("Доступ к приватному репозиторию запрещен".to_string());
    }

    let target_branch = branch.unwrap_or(default_branch);
    let n = limit.unwrap_or(50);

    let log_cmd = format!(
        "git --git-dir=\"{}\" log -n {} --pretty=format:\"%H|||%h|||%an|||%ae|||%cr|||%s\" \"{}\" 2>/dev/null || true",
        repo_path, n, target_branch
    );
    let lines = exec_server_cmd(&client, &log_cmd).await;

    let mut commits = Vec::new();
    for line in lines {
        let parts: Vec<&str> = line.split("|||").collect();
        if parts.len() >= 6 {
            commits.push(GitCommitDto {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author_name: parts[2].to_string(),
                author_email: parts[3].to_string(),
                date: parts[4].to_string(),
                message: parts[5].to_string(),
            });
        }
    }

    Ok(commits)
}

#[tauri::command]
pub async fn get_repository_branches(
    user_email: String,
    repo_id: i64,
) -> Result<Vec<String>, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row = client
        .query_one(
            "SELECT repo_path, default_branch, is_private, owner_email FROM server_repositories WHERE id = $1;",
            &[&repo_id],
        )
        .await
        .map_err(|_| "Репозиторий не найден".to_string())?;

    let repo_path: String = row.get(0);
    let default_branch: String = row.get(1);
    let is_private: bool = row.get(2);
    let owner_email: String = row.get(3);

    if is_private && owner_email != user_email {
        return Err("Доступ к приватному репозиторию запрещен".to_string());
    }

    let branch_cmd = format!(
        "git --git-dir=\"{}\" branch --format=\"%(refname:short)\" 2>/dev/null || true",
        repo_path
    );
    let lines = exec_server_cmd(&client, &branch_cmd).await;

    let mut branches: Vec<String> = lines
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if branches.is_empty() {
        branches.push(default_branch);
    }

    Ok(branches)
}

#[tauri::command]
pub async fn update_server_repository(
    user_email: String,
    repo_id: i64,
    description: Option<String>,
    is_private: Option<bool>,
) -> Result<bool, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let row_opt = client
        .query_opt(
            "SELECT owner_email FROM server_repositories WHERE id = $1;",
            &[&repo_id],
        )
        .await
        .map_err(|e| format!("Ошибка поиска репозитория: {}", e))?;

    let owner: String = match row_opt {
        Some(r) => r.get(0),
        None => return Err("Репозиторий не найден".to_string()),
    };

    if owner != user_email {
        return Err("Только владелец может изменять настройки репозитория".to_string());
    }

    if let Some(desc) = description {
        client
            .execute(
                "UPDATE server_repositories SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                &[&desc, &repo_id],
            )
            .await
            .map_err(|e| format!("Ошибка обновления описания: {}", e))?;
    }

    if let Some(priv_flag) = is_private {
        client
            .execute(
                "UPDATE server_repositories SET is_private = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                &[&priv_flag, &repo_id],
            )
            .await
            .map_err(|e| format!("Ошибка обновления видимости: {}", e))?;
    }

    Ok(true)
}
