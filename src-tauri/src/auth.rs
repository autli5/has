use serde::{Deserialize, Serialize};
use std::env;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub dbname: String,
    pub ssl_mode: String,
    pub users_table: String,
    pub email_column: String,
    pub password_column: String,
    pub database_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStatus {
    pub connected: bool,
    pub host: String,
    pub dbname: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDto {
    pub email: String,
    pub username: Option<String>,
    pub role: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub user: Option<UserDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetRequestResponse {
    pub success: bool,
    pub message: String,
    pub dev_code: Option<String>,
}

#[derive(Debug, Clone)]
struct ResetEntry {
    code: String,
    expires_at: std::time::Instant,
    verified: bool,
}

pub fn load_env() {
    // 1. Current directory .env
    let _ = dotenvy::dotenv();

    // 2. Parent directory .env (useful in tauri dev when cwd might be src-tauri)
    let _ = dotenvy::from_filename("../.env");

    // 3. Executable directory .env (useful in production bundle)
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let _ = dotenvy::from_path(exe_dir.join(".env"));
            if let Some(parent) = exe_dir.parent() {
                let _ = dotenvy::from_path(parent.join(".env"));
                if let Some(grandparent) = parent.parent() {
                    let _ = dotenvy::from_path(grandparent.join(".env"));
                }
            }
        }
    }
}

pub fn extract_clean_env(key: &str, default: &str) -> String {
    env::var(key)
        .map(|v| {
            let trimmed = v.trim();
            let clean = if let Some((c, _)) = trimmed.split_once('#') {
                c.trim()
            } else {
                trimmed
            };
            if clean.is_empty() {
                default.to_string()
            } else {
                clean.to_string()
            }
        })
        .unwrap_or_else(|_| default.to_string())
}

pub fn get_db_config() -> DbConfig {
    load_env();

    let database_url = env::var("DATABASE_URL").ok().filter(|s| !s.trim().is_empty());
    let host = extract_clean_env("DB_HOST", "80.237.77.141");
    let port = extract_clean_env("DB_PORT", "5432")
        .parse::<u16>()
        .unwrap_or(5432);
    let user = extract_clean_env("DB_USER", "uj3v230o");
    let pass_str = extract_clean_env("DB_PASSWORD", "48758ef4");
    let password = if !pass_str.is_empty() {
        Some(pass_str)
    } else {
        Some("48758ef4".to_string())
    };
    let dbname = extract_clean_env("DB_NAME", "has");
    let ssl_mode = extract_clean_env("DB_SSL_MODE", "prefer").to_lowercase();

    let users_table = extract_clean_env("DB_USERS_TABLE", "users");
    let email_column = extract_clean_env("DB_EMAIL_COLUMN", "email");
    let password_column = extract_clean_env("DB_PASSWORD_COLUMN", "password");

    DbConfig {
        host,
        port,
        user,
        password,
        dbname,
        ssl_mode,
        users_table,
        email_column,
        password_column,
        database_url,
    }
}

fn build_conn_string(config: &DbConfig) -> String {
    if let Some(url) = &config.database_url {
        if !url.trim().is_empty() {
            return url.clone();
        }
    }

    let mut parts = vec![
        format!("host={}", config.host),
        format!("port={}", config.port),
        format!("user={}", config.user),
        format!("dbname={}", config.dbname),
    ];

    if let Some(ref pwd) = config.password {
        if !pwd.is_empty() {
            parts.push(format!("password={}", pwd));
        }
    }

    parts.join(" ")
}

pub async fn connect_to_db(config: &DbConfig) -> Result<tokio_postgres::Client, String> {
    let conn_str = build_conn_string(config);

    // Try SSL if mode is 'require' or 'prefer'
    if config.ssl_mode == "require" || config.ssl_mode == "prefer" {
        let mut builder = native_tls::TlsConnector::builder();
        builder.danger_accept_invalid_certs(true); // Allow self-signed certs for remote VPS

        if let Ok(tls_connector) = builder.build() {
            let tls = postgres_native_tls::MakeTlsConnector::new(tls_connector);
            match tokio_postgres::connect(&conn_str, tls).await {
                Ok((client, connection)) => {
                    tokio::spawn(async move {
                        if let Err(e) = connection.await {
                            eprintln!("PostgreSQL connection error: {}", e);
                        }
                    });
                    return Ok(client);
                }
                Err(e) => {
                    if config.ssl_mode == "require" {
                        return Err(format!("TLS connection failed: {}", e));
                    }
                    // If prefer, fallback to NoTls below
                }
            }
        }
    }

    // Connect with NoTls
    match tokio_postgres::connect(&conn_str, tokio_postgres::NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    eprintln!("PostgreSQL connection error: {}", e);
                }
            });
            Ok(client)
        }
        Err(e) => Err(format!("Failed to connect to PostgreSQL ({}): {}", config.host, e)),
    }
}

pub fn verify_password(provided: &str, stored: &str) -> bool {
    let stored = stored.trim();

    // 1. Bcrypt hash check ($2a$, $2b$, $2y$)
    if stored.starts_with("$2a$") || stored.starts_with("$2b$") || stored.starts_with("$2y$") {
        if let Ok(valid) = bcrypt::verify(provided, stored) {
            return valid;
        }
    }

    // 2. SHA-256 hash check (64 hex characters)
    if stored.len() == 64 && stored.chars().all(|c| c.is_ascii_hexdigit()) {
        let mut hasher = Sha256::new();
        hasher.update(provided.as_bytes());
        let hash = hex::encode(hasher.finalize());
        if hash.eq_ignore_ascii_case(stored) {
            return true;
        }
    }

    // 3. Direct plaintext match
    provided == stored
}

pub fn get_error_message(e: &tokio_postgres::Error) -> String {
    if let Some(dbe) = e.as_db_error() {
        dbe.message().to_string()
    } else {
        e.to_string()
    }
}

pub async fn check_db_health() -> DbStatus {
    let config = get_db_config();
    match connect_to_db(&config).await {
        Ok(client) => {
            match client.simple_query("SELECT 1;").await {
                Ok(_) => DbStatus {
                    connected: true,
                    host: config.host.clone(),
                    dbname: config.dbname.clone(),
                    message: format!("Подключено к базе данных '{}' на '{}:{}'", config.dbname, config.host, config.port),
                },
                Err(e) => DbStatus {
                    connected: false,
                    host: config.host.clone(),
                    dbname: config.dbname.clone(),
                    message: format!("Ошибка выполнения запроса: {}", get_error_message(&e)),
                },
            }
        }
        Err(e) => DbStatus {
            connected: false,
            host: config.host.clone(),
            dbname: config.dbname.clone(),
            message: e,
        },
    }
}

pub async fn authenticate_user(email: &str, password: &str) -> AuthResponse {
    let clean_email = email.trim();
    if clean_email.is_empty() || password.is_empty() {
        return AuthResponse {
            success: false,
            message: "Email и пароль обязательны для заполнения".to_string(),
            user: None,
        };
    }

    let config = get_db_config();
    let client = match connect_to_db(&config).await {
        Ok(c) => c,
        Err(err) => {
            return AuthResponse {
                success: false,
                message: format!("Ошибка подключения к БД ({}:{}): {}. Проверьте файл .env", config.host, config.port, err),
                user: None,
            };
        }
    };

    // Sanitize identifier names (allow only alphanumeric + underscore to avoid injection in table/col names)
    let is_safe_ident = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_alphanumeric() || c == '_');
    if !is_safe_ident(&config.users_table) || !is_safe_ident(&config.email_column) || !is_safe_ident(&config.password_column) {
        return AuthResponse {
            success: false,
            message: "Некорректные имена таблиц или колонок в конфигурации .env".to_string(),
            user: None,
        };
    }

    // Auto-create table if standard 'users' table
    if config.users_table == "users" && config.email_column == "email" && config.password_column == "password" {
        let create_table_sql = "
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                username VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
            UPDATE users SET role = 'admin' WHERE id = 1 AND (role IS NULL OR role = '');
        ";
        let _ = client.batch_execute(create_table_sql).await;
    }

    let query_with_role = format!(
        "SELECT {}, username, role, avatar FROM {} WHERE LOWER({}) = LOWER($1) LIMIT 1",
        config.password_column, config.users_table, config.email_column
    );

    let query_result = match client.query_opt(&query_with_role, &[&clean_email]).await {
        Ok(row_opt) => Ok(row_opt),
        Err(_) => {
            let query_fallback = format!(
                "SELECT {} FROM {} WHERE LOWER({}) = LOWER($1) LIMIT 1",
                config.password_column, config.users_table, config.email_column
            );
            client.query_opt(&query_fallback, &[&clean_email]).await
        }
    };

    match query_result {
        Ok(Some(row)) => {
            let stored_pwd: Result<String, _> = row.try_get(0);
            let username: Option<String> = row.try_get(1).ok();
            let role_opt: Option<String> = row.try_get(2).ok();
            let avatar: Option<String> = row.try_get(3).ok();
            let role = role_opt.filter(|r| !r.trim().is_empty()).unwrap_or_else(|| "user".to_string());
            match stored_pwd {
                Ok(stored_password) => {
                    if verify_password(password, &stored_password) {
                        AuthResponse {
                            success: true,
                            message: "Успешная авторизация".to_string(),
                            user: Some(UserDto {
                                email: clean_email.to_string(),
                                username,
                                role,
                                avatar,
                            }),
                        }
                    } else {
                        AuthResponse {
                            success: false,
                            message: "Неверный пароль".to_string(),
                            user: None,
                        }
                    }
                }
                Err(e) => AuthResponse {
                    success: false,
                    message: format!("Ошибка чтения пароля из базы: {}", e),
                    user: None,
                },
            }
        }
        Ok(None) => AuthResponse {
            success: false,
            message: "Пользователь с таким email не найден".to_string(),
            user: None,
        },
        Err(e) => {
            let msg = get_error_message(&e);
            if msg.contains("does not exist") || msg.contains("не существует") {
                AuthResponse {
                    success: false,
                    message: format!("Таблица '{}' не найдена в базе данных. Зарегистрируйтесь, чтобы создать её.", config.users_table),
                    user: None,
                }
            } else if msg.contains("permission denied") || msg.contains("отказано в доступе") {
                AuthResponse {
                    success: false,
                    message: format!("Отказано в доступе к таблице '{}' для пользователя '{}'. Проверьте права в PostgreSQL.", config.users_table, config.user),
                    user: None,
                }
            } else {
                AuthResponse {
                    success: false,
                    message: format!("Ошибка запроса к БД: {}", msg),
                    user: None,
                }
            }
        }
    }
}

pub async fn register_user(email: &str, password: &str, username: Option<&str>) -> AuthResponse {
    let clean_email = email.trim();
    let clean_username = username.map(|u| u.trim()).filter(|u| !u.is_empty());
    if clean_email.is_empty() || password.is_empty() {
        return AuthResponse {
            success: false,
            message: "Email и пароль обязательны".to_string(),
            user: None,
        };
    }

    let config = get_db_config();
    let client = match connect_to_db(&config).await {
        Ok(c) => c,
        Err(err) => {
            return AuthResponse {
                success: false,
                message: format!("Ошибка подключения к БД: {}. Проверьте файл .env", err),
                user: None,
            };
        }
    };

    // Auto-create table if standard 'users' table
    if config.users_table == "users" && config.email_column == "email" && config.password_column == "password" {
        let create_table_sql = "
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                username VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
            UPDATE users SET role = 'admin' WHERE id = 1 AND (role IS NULL OR role = '');
        ";
        let _ = client.batch_execute(create_table_sql).await;
    }

    // Determine initial role: if users table has 0 users, this first user is admin
    let user_count: i64 = client
        .query_one(&format!("SELECT COUNT(*) FROM {}", config.users_table), &[])
        .await
        .map(|r| r.get(0))
        .unwrap_or(1);
    let assigned_role = if user_count == 0 { "admin" } else { "user" };

    // Hash password with bcrypt
    let hashed_password = match bcrypt::hash(password, 10) {
        Ok(h) => h,
        Err(e) => return AuthResponse {
            success: false,
            message: format!("Ошибка хеширования пароля: {}", e),
            user: None,
        },
    };

    let insert_query = format!(
        "INSERT INTO {} ({}, {}, username, role) VALUES ($1, $2, $3, $4)",
        config.users_table, config.email_column, config.password_column
    );

    let insert_res = match client.execute(&insert_query, &[&clean_email, &hashed_password, &clean_username, &assigned_role]).await {
        Ok(n) => Ok(n),
        Err(_) => {
            let fallback_insert = format!(
                "INSERT INTO {} ({}, {}) VALUES ($1, $2)",
                config.users_table, config.email_column, config.password_column
            );
            client.execute(&fallback_insert, &[&clean_email, &hashed_password]).await
        }
    };

    match insert_res {
        Ok(_) => AuthResponse {
            success: true,
            message: "Аккаунт успешно создан".to_string(),
            user: Some(UserDto {
                email: clean_email.to_string(),
                username: clean_username.map(String::from),
                role: assigned_role.to_string(),
                avatar: None,
            }),
        },
        Err(e) => {
            let err_str = get_error_message(&e);
            if err_str.contains("unique") || err_str.contains("duplicate") || err_str.contains("уже существует") {
                AuthResponse {
                    success: false,
                    message: "Пользователь с таким email уже существует".to_string(),
                    user: None,
                }
            } else {
                AuthResponse {
                    success: false,
                    message: format!("Ошибка сохранения: {}", err_str),
                    user: None,
                }
            }
        }
    }
}

static RESET_CODES: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, ResetEntry>>> = std::sync::OnceLock::new();

fn get_reset_codes() -> &'static std::sync::Mutex<std::collections::HashMap<String, ResetEntry>> {
    RESET_CODES.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn generate_reset_code() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let num = (nanos % 900_000) + 100_000;
    format!("{:06}", num)
}

pub async fn send_smtp_email(
    host: &str,
    port: u16,
    user: &str,
    pass: &str,
    from: &str,
    to: &str,
    subject: &str,
    body: &str,
) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use base64::Engine;

    let host = host.trim();
    let user = user.trim();
    let pass = pass.trim();
    let sender = if !from.trim().is_empty() { from.trim() } else { user };

    let tcp = tokio::net::TcpStream::connect((host, port))
        .await
        .map_err(|e| format!("Не удалось подключиться к SMTP {}:{}: {}", host, port, e))?;

    let mut builder = native_tls::TlsConnector::builder();
    builder.danger_accept_invalid_certs(true);
    let tls_connector = builder.build().map_err(|e| e.to_string())?;
    let tokio_tls = tokio_native_tls::TlsConnector::from(tls_connector);

    let tls_stream = tokio_tls
        .connect(host, tcp)
        .await
        .map_err(|e| format!("TLS ошибка SMTP {}:{}: {}", host, port, e))?;

    let (reader, mut writer) = tokio::io::split(tls_stream);
    let mut reader = BufReader::new(reader);

    async fn read_reply<R: AsyncBufReadExt + Unpin>(reader: &mut R, expected: &str) -> Result<String, String> {
        let mut last_line;
        loop {
            let mut line = String::new();
            let n = reader.read_line(&mut line).await.map_err(|e| format!("Ошибка чтения ответа SMTP: {}", e))?;
            if n == 0 {
                return Err("SMTP соединение неожиданно закрыто сервером".to_string());
            }
            last_line = line.clone();
            // Multi-line SMTP: lines start with "XYZ-", the last line is "XYZ "
            if line.len() >= 4 && line[..3].chars().all(|c| c.is_ascii_digit()) && line.as_bytes()[3] == b' ' {
                break;
            }
            if line.len() >= 3 && line[..3].chars().all(|c| c.is_ascii_digit()) && line.len() < 4 {
                break;
            }
        }
        if !last_line.starts_with(expected) {
            return Err(format!("SMTP неожиданный ответ: {}", last_line.trim()));
        }
        Ok(last_line)
    }

    async fn send_cmd<W: AsyncWriteExt + Unpin, R: AsyncBufReadExt + Unpin>(
        writer: &mut W,
        reader: &mut R,
        cmd: &str,
        expected: &str,
    ) -> Result<String, String> {
        writer.write_all(cmd.as_bytes()).await.map_err(|e| format!("Ошибка отправки команды SMTP: {}", e))?;
        writer.flush().await.map_err(|e| format!("Ошибка flush SMTP: {}", e))?;
        read_reply(reader, expected).await
    }

    // Read initial 220 banner (e.g. "220 smtp.mail.ru ESMTP ready")
    read_reply(&mut reader, "220").await?;

    // Send EHLO
    send_cmd(&mut writer, &mut reader, "EHLO mail.ru\r\n", "250").await?;

    // AUTH LOGIN if credentials given
    if !user.is_empty() && !pass.is_empty() {
        send_cmd(&mut writer, &mut reader, "AUTH LOGIN\r\n", "334").await?;
        let user_b64 = base64::engine::general_purpose::STANDARD.encode(user);
        send_cmd(&mut writer, &mut reader, &format!("{}\r\n", user_b64), "334").await?;
        let pass_b64 = base64::engine::general_purpose::STANDARD.encode(pass);
        send_cmd(&mut writer, &mut reader, &format!("{}\r\n", pass_b64), "235").await?;
    }

    send_cmd(&mut writer, &mut reader, &format!("MAIL FROM:<{}>\r\n", sender), "250").await?;
    send_cmd(&mut writer, &mut reader, &format!("RCPT TO:<{}>\r\n", to), "250").await?;
    send_cmd(&mut writer, &mut reader, "DATA\r\n", "354").await?;

    let subj_b64 = base64::engine::general_purpose::STANDARD.encode(subject);
    let msg = format!(
        "From: <{}>\r\nTo: <{}>\r\nSubject: =?UTF-8?B?{}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{}\r\n.\r\n",
        sender, to, subj_b64, body
    );
    send_cmd(&mut writer, &mut reader, &msg, "250").await?;
    let _ = send_cmd(&mut writer, &mut reader, "QUIT\r\n", "221").await;

    Ok(())
}

pub async fn request_reset_code(email: &str) -> ResetRequestResponse {
    let clean_email = email.trim();
    if clean_email.is_empty() {
        return ResetRequestResponse {
            success: false,
            message: "Пожалуйста, введите адрес электронной почты".to_string(),
            dev_code: None,
        };
    }

    let config = get_db_config();
    let client = match connect_to_db(&config).await {
        Ok(c) => c,
        Err(e) => {
            return ResetRequestResponse {
                success: false,
                message: format!("Ошибка подключения к БД: {}", e),
                dev_code: None,
            };
        }
    };

    let check_query = format!(
        "SELECT 1 FROM {} WHERE LOWER({}) = LOWER($1) LIMIT 1",
        config.users_table, config.email_column
    );

    match client.query_opt(&check_query, &[&clean_email]).await {
        Ok(Some(_)) => {
            let code = generate_reset_code();
            let expires_at = std::time::Instant::now() + std::time::Duration::from_secs(900); // 15 mins

            {
                let mut map = get_reset_codes().lock().unwrap();
                map.insert(clean_email.to_lowercase(), ResetEntry {
                    code: code.clone(),
                    expires_at,
                    verified: false,
                });
            }

            let smtp_host = extract_clean_env("SMTP_HOST", "smtp.mail.ru");
            let smtp_port = extract_clean_env("SMTP_PORT", "465").parse::<u16>().unwrap_or(465);
            let smtp_user = extract_clean_env("SMTP_USER", "scorporation@internet.ru");
            let smtp_pass = extract_clean_env("SMTP_PASSWORD", "87AhqOfdlC5LPb5eIX3N");
            let smtp_from = extract_clean_env("SMTP_FROM", &smtp_user);

            let dev_code;
            if !smtp_host.is_empty() {
                let subject = "Home Autli Server: Код сброса пароля";
                let body = format!(
                    "Здравствуйте!\n\nВаш проверочный код для смены пароля в Home Autli Server: {}\n\nКод действителен в течение 15 минут.\nЕсли вы не запрашивали смену пароля, просто проигнорируйте это письмо.",
                    code
                );
                match send_smtp_email(&smtp_host, smtp_port, &smtp_user, &smtp_pass, &smtp_from, clean_email, subject, &body).await {
                    Ok(_) => {
                        return ResetRequestResponse {
                            success: true,
                            message: format!("Код подтверждения отправлен на почту {}", clean_email),
                            dev_code: None,
                        };
                    }
                    Err(e) => {
                        eprintln!("Не удалось отправить email через SMTP: {}. Тестовый код: {}", e, code);
                        dev_code = Some(code.clone());
                    }
                }
            } else {
                dev_code = Some(code.clone());
            }

            ResetRequestResponse {
                success: true,
                message: if dev_code.is_some() {
                    format!("Код сгенерирован! (Тестовый режим: ваш код — {})", code)
                } else {
                    format!("Код подтверждения отправлен на {}", clean_email)
                },
                dev_code,
            }
        }
        Ok(None) => ResetRequestResponse {
            success: false,
            message: "Пользователь с таким email не найден в базе данных".to_string(),
            dev_code: None,
        },
        Err(e) => ResetRequestResponse {
            success: false,
            message: format!("Ошибка запроса к базе данных: {}", e),
            dev_code: None,
        },
    }
}

pub fn verify_reset_code(email: &str, code: &str) -> AuthResponse {
    let clean_email = email.trim().to_lowercase();
    let clean_code = code.trim();

    let mut map = get_reset_codes().lock().unwrap();
    if let Some(entry) = map.get_mut(&clean_email) {
        if std::time::Instant::now() > entry.expires_at {
            return AuthResponse {
                success: false,
                message: "Срок действия кода истек. Запросите новый код.".to_string(),
                user: None,
            };
        }

        if entry.code == clean_code {
            entry.verified = true;
            AuthResponse {
                success: true,
                message: "Код подтвержден. Введите новый пароль.".to_string(),
                user: None,
            }
        } else {
            AuthResponse {
                success: false,
                message: "Неверный проверочный код".to_string(),
                user: None,
            }
        }
    } else {
        AuthResponse {
            success: false,
            message: "Код подтверждения не запрашивался для этой почты".to_string(),
            user: None,
        }
    }
}

pub async fn reset_password_with_code(email: &str, code: &str, new_password: &str) -> AuthResponse {
    let clean_email = email.trim();
    let clean_code = code.trim();

    if new_password.trim().is_empty() {
        return AuthResponse {
            success: false,
            message: "Новый пароль не может быть пустым".to_string(),
            user: None,
        };
    }

    {
        let map = get_reset_codes().lock().unwrap();
        if let Some(entry) = map.get(&clean_email.to_lowercase()) {
            if std::time::Instant::now() > entry.expires_at {
                return AuthResponse {
                    success: false,
                    message: "Срок действия кода истек. Пожалуйста, запросите код заново.".to_string(),
                    user: None,
                };
            }
            if entry.code != clean_code && !entry.verified {
                return AuthResponse {
                    success: false,
                    message: "Неверный проверочный код".to_string(),
                    user: None,
                };
            }
        } else {
            return AuthResponse {
                success: false,
                message: "Сессия сброса пароля не найдена. Начните сначала.".to_string(),
                user: None,
            };
        }
    }

    let config = get_db_config();
    let client = match connect_to_db(&config).await {
        Ok(c) => c,
        Err(e) => {
            return AuthResponse {
                success: false,
                message: format!("Ошибка подключения к БД: {}", e),
                user: None,
            };
        }
    };

    let hashed_password = match bcrypt::hash(new_password, 10) {
        Ok(h) => h,
        Err(e) => {
            return AuthResponse {
                success: false,
                message: format!("Ошибка хеширования: {}", e),
                user: None,
            };
        }
    };

    let update_query = format!(
        "UPDATE {} SET {} = $1 WHERE LOWER({}) = LOWER($2)",
        config.users_table, config.password_column, config.email_column
    );

    match client.execute(&update_query, &[&hashed_password, &clean_email]).await {
        Ok(rows) if rows > 0 => {
            let mut map = get_reset_codes().lock().unwrap();
            map.remove(&clean_email.to_lowercase());

            AuthResponse {
                success: true,
                message: "Пароль успешно изменен! Теперь вы можете войти с новым паролем.".to_string(),
                user: Some(UserDto {
                    email: clean_email.to_string(),
                    username: None,
                    role: "user".to_string(),
                    avatar: None,
                }),
            }
        }
        Ok(_) => AuthResponse {
            success: false,
            message: "Пользователь не найден в базе данных".to_string(),
            user: None,
        },
        Err(e) => AuthResponse {
            success: false,
            message: format!("Ошибка обновления пароля в базе: {}", e),
            user: None,
        },
    }
}
