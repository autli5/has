use serde::{Deserialize, Serialize};
use crate::auth::{connect_to_db, get_db_config};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceSecurityInfo {
    pub current_device_name: String,
    pub current_ip: String,
    pub is_admin: bool,
    pub device_binding_enabled: bool,
    pub trusted_device_name: Option<String>,
    pub ip_binding_enabled: bool,
    pub trusted_ip: Option<String>,
    pub is_device_allowed: bool,
    pub is_ip_allowed: bool,
    pub can_admin_manage: bool,
}

pub fn get_current_device_name() -> String {
    if let Ok(name) = std::env::var("COMPUTERNAME") {
        if !name.trim().is_empty() {
            return name.trim().to_string();
        }
    }
    if let Ok(name) = std::env::var("HOSTNAME") {
        if !name.trim().is_empty() {
            return name.trim().to_string();
        }
    }
    if let Ok(output) = std::process::Command::new("hostname").output() {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() {
                return s;
            }
        }
    }
    if let Ok(user) = std::env::var("USER") {
        return format!("{}-workstation", user.trim());
    }
    "main-workstation".to_string()
}

pub fn get_current_local_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

pub async fn init_admin_security_table(client: &tokio_postgres::Client) -> Result<(), String> {
    let sql = "
        CREATE TABLE IF NOT EXISTS admin_security_config (
            id SERIAL PRIMARY KEY,
            device_binding_enabled BOOLEAN DEFAULT FALSE,
            trusted_device_name VARCHAR(255),
            ip_binding_enabled BOOLEAN DEFAULT FALSE,
            trusted_ip VARCHAR(100)
        );
        INSERT INTO admin_security_config (id, device_binding_enabled, ip_binding_enabled)
        VALUES (1, false, false)
        ON CONFLICT (id) DO NOTHING;
    ";
    client
        .batch_execute(sql)
        .await
        .map_err(|e| format!("Ошибка создания таблицы безопасности: {}", e))
}

pub async fn get_admin_security_info(admin_email: &str) -> Result<DeviceSecurityInfo, String> {
    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_admin_security_table(&client).await?;

    let clean_email = admin_email.trim().to_lowercase();
    let user_row = client
        .query_opt(
            &format!(
                "SELECT role, id FROM {} WHERE LOWER({}) = LOWER($1)",
                config.users_table, config.email_column
            ),
            &[&clean_email],
        )
        .await
        .map_err(|e| format!("Ошибка проверки роли: {}", e))?;

    let (is_admin, _user_id) = match user_row {
        Some(row) => {
            let role: Option<String> = row.try_get(0).ok().flatten();
            let id: i32 = row.get(1);
            let is_adm = id == 1 || matches!(role.as_deref(), Some("admin") | Some("Администратор"));
            (is_adm, id)
        }
        None => (false, -1),
    };

    let cfg_row = client
        .query_one(
            "SELECT device_binding_enabled, trusted_device_name, ip_binding_enabled, trusted_ip FROM admin_security_config WHERE id = 1",
            &[],
        )
        .await
        .map_err(|e| format!("Ошибка чтения параметров безопасности: {}", e))?;

    let device_binding_enabled: bool = cfg_row.get(0);
    let trusted_device_name: Option<String> = cfg_row.get(1);
    let ip_binding_enabled: bool = cfg_row.get(2);
    let trusted_ip: Option<String> = cfg_row.get(3);

    let current_device = get_current_device_name();
    let current_ip = get_current_local_ip();

    let is_device_allowed = if !device_binding_enabled {
        true
    } else {
        match &trusted_device_name {
            Some(t) => t.trim().eq_ignore_ascii_case(&current_device.trim()),
            None => true,
        }
    };

    let is_ip_allowed = if !ip_binding_enabled {
        true
    } else {
        match &trusted_ip {
            Some(t) => t.trim().eq_ignore_ascii_case(&current_ip.trim()),
            None => true,
        }
    };

    let can_admin_manage = is_admin && is_device_allowed && is_ip_allowed;

    Ok(DeviceSecurityInfo {
        current_device_name: current_device,
        current_ip,
        is_admin,
        device_binding_enabled,
        trusted_device_name,
        ip_binding_enabled,
        trusted_ip,
        is_device_allowed,
        is_ip_allowed,
        can_admin_manage,
    })
}

pub async fn update_admin_security_policy(
    admin_email: &str,
    device_binding: bool,
    trusted_device: Option<String>,
    ip_binding: bool,
    trusted_ip: Option<String>,
) -> Result<DeviceSecurityInfo, String> {
    let sec_info = get_admin_security_info(admin_email).await?;
    if !sec_info.is_admin {
        return Err("Доступ запрещен: действие доступно только администратору".to_string());
    }

    let config = get_db_config();
    let client = connect_to_db(&config).await?;
    init_admin_security_table(&client).await?;

    let trusted_dev_clean = trusted_device.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let trusted_ip_clean = trusted_ip.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    client
        .execute(
            "UPDATE admin_security_config 
             SET device_binding_enabled = $1, trusted_device_name = $2, ip_binding_enabled = $3, trusted_ip = $4 
             WHERE id = 1",
            &[&device_binding, &trusted_dev_clean, &ip_binding, &trusted_ip_clean],
        )
        .await
        .map_err(|e| format!("Ошибка сохранения политики безопасности: {}", e))?;

    get_admin_security_info(admin_email).await
}

pub async fn admin_update_user(
    admin_email: &str,
    target_id: i32,
    new_username: Option<String>,
    new_email: Option<String>,
    new_role: Option<String>,
    new_password: Option<String>,
) -> Result<String, String> {
    let sec_info = get_admin_security_info(admin_email).await?;
    if !sec_info.can_admin_manage {
        return Err("Отказано в доступе: устройство или IP не авторизованы для управления".to_string());
    }

    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let clean_username = new_username.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let clean_role = new_role.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "user".to_string());
    let clean_email = new_email.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if let Some(pwd) = new_password.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        let hashed = bcrypt::hash(&pwd, 10).map_err(|e| format!("Ошибка хеширования: {}", e))?;
        if let Some(em) = clean_email {
            let update_sql = format!(
                "UPDATE {} SET username = $1, {} = $2, role = $3, {} = $4 WHERE id = $5",
                config.users_table, config.email_column, config.password_column
            );
            client
                .execute(&update_sql, &[&clean_username, &em, &clean_role, &hashed, &target_id])
                .await
                .map_err(|e| format!("Ошибка обновления пользователя: {}", e))?;
        } else {
            let update_sql = format!(
                "UPDATE {} SET username = $1, role = $2, {} = $3 WHERE id = $4",
                config.users_table, config.password_column
            );
            client
                .execute(&update_sql, &[&clean_username, &clean_role, &hashed, &target_id])
                .await
                .map_err(|e| format!("Ошибка обновления пользователя: {}", e))?;
        }
    } else {
        if let Some(em) = clean_email {
            let update_sql = format!(
                "UPDATE {} SET username = $1, {} = $2, role = $3 WHERE id = $4",
                config.users_table, config.email_column
            );
            client
                .execute(&update_sql, &[&clean_username, &em, &clean_role, &target_id])
                .await
                .map_err(|e| format!("Ошибка обновления пользователя: {}", e))?;
        } else {
            let update_sql = format!(
                "UPDATE {} SET username = $1, role = $2 WHERE id = $3",
                config.users_table
            );
            client
                .execute(&update_sql, &[&clean_username, &clean_role, &target_id])
                .await
                .map_err(|e| format!("Ошибка обновления пользователя: {}", e))?;
        }
    }

    Ok("Данные пользователя успешно обновлены".to_string())
}

pub async fn admin_delete_user(admin_email: &str, target_id: i32) -> Result<String, String> {
    let sec_info = get_admin_security_info(admin_email).await?;
    if !sec_info.can_admin_manage {
        return Err("Отказано в доступе: устройство или IP не авторизованы для управления".to_string());
    }

    if target_id == 1 {
        return Err("Нельзя удалить основного системного администратора (ID: 1)".to_string());
    }

    let config = get_db_config();
    let client = connect_to_db(&config).await?;

    let self_row = client
        .query_opt(
            &format!("SELECT id FROM {} WHERE LOWER({}) = LOWER($1)", config.users_table, config.email_column),
            &[&admin_email.trim().to_lowercase()],
        )
        .await
        .map_err(|e| format!("Ошибка проверки: {}", e))?;

    if let Some(r) = self_row {
        let self_id: i32 = r.get(0);
        if self_id == target_id {
            return Err("Нельзя удалить собственную учетную запись администратора".to_string());
        }
    }

    let delete_sql = format!("DELETE FROM {} WHERE id = $1", config.users_table);
    client
        .execute(&delete_sql, &[&target_id])
        .await
        .map_err(|e| format!("Ошибка удаления пользователя: {}", e))?;

    Ok("Пользователь успешно удален".to_string())
}
