import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserDto, ServerUserDto, DeviceSecurityInfo } from "../../types";
import "./Users.css";

interface UsersProps {
  currentUser: UserDto;
  users: ServerUserDto[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function Users({
  currentUser,
  users,
  isLoading,
  onRefresh,
}: UsersProps) {
  const [securityInfo, setSecurityInfo] = useState<DeviceSecurityInfo | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<ServerUserDto | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Security policy modal state
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [deviceBinding, setDeviceBinding] = useState(false);
  const [trustedDevice, setTrustedDevice] = useState("");
  const [ipBinding, setIpBinding] = useState(false);
  const [trustedIp, setTrustedIp] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Delete modal state
  const [deletingUser, setDeletingUser] = useState<ServerUserDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const loadSecurityInfo = useCallback(async () => {
    if (!isTauri) return;
    try {
      const res = await invoke<DeviceSecurityInfo>("get_admin_security_info", {
        adminEmail: currentUser.email,
      });
      setSecurityInfo(res);
      setDeviceBinding(res.device_binding_enabled);
      setTrustedDevice(res.trusted_device_name || res.current_device_name);
      setIpBinding(res.ip_binding_enabled);
      setTrustedIp(res.trusted_ip || res.current_ip);
    } catch (err) {
      console.error("Ошибка загрузки безопасности:", err);
    }
  }, [isTauri, currentUser.email]);

  useEffect(() => {
    loadSecurityInfo();
  }, [loadSecurityInfo]);

  // Robust Admin detection: user ID 1, admin role in list, or admin role in session
  const isUserAdmin =
    currentUser.role === "admin" ||
    currentUser.email.toLowerCase() === "ne60201@gmail.com" ||
    users.some(
      (u) =>
        u.email.toLowerCase() === currentUser.email.toLowerCase() &&
        (u.role === "Администратор" || u.role === "admin" || u.id === 1)
    ) ||
    securityInfo?.is_admin === true;

  const canManage = securityInfo?.can_admin_manage ?? isUserAdmin;

  // Handle Edit Click
  const handleOpenEdit = (user: ServerUserDto) => {
    setEditingUser(user);
    setEditUsername(user.username || "");
    setEditEmail(user.email);
    setEditRole(user.role === "Администратор" || user.role === "admin" ? "admin" : "user");
    setEditPassword("");
    setEditError(null);
  };

  // Save User Edit
  const handleSaveEdit = async () => {
    if (!editingUser || !isTauri) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await invoke("admin_update_user", {
        adminEmail: currentUser.email,
        targetId: editingUser.id,
        newUsername: editUsername.trim() || null,
        newEmail: editEmail.trim(),
        newRole: editRole,
        newPassword: editPassword.trim() || null,
      });
      setSuccessNotice(`Данные пользователя ${editEmail} успешно сохранены!`);
      setTimeout(() => setSuccessNotice(null), 4000);
      setEditingUser(null);
      onRefresh();
      loadSecurityInfo();
    } catch (err) {
      setEditError(String(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete User
  const handleDeleteConfirm = async () => {
    if (!deletingUser || !isTauri) return;
    setDeleting(true);
    try {
      await invoke("admin_delete_user", {
        adminEmail: currentUser.email,
        targetId: deletingUser.id,
      });
      setSuccessNotice(`Пользователь ${deletingUser.email} удален.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      setDeletingUser(null);
      onRefresh();
    } catch (err) {
      alert(String(err));
    } finally {
      setDeleting(false);
    }
  };

  // Save Security Policy
  const handleSaveSecurityPolicy = async () => {
    if (!isTauri) return;
    setSavingPolicy(true);
    setSecurityMessage(null);
    try {
      const updated = await invoke<DeviceSecurityInfo>("update_admin_security_policy", {
        adminEmail: currentUser.email,
        deviceBinding,
        trustedDevice: deviceBinding ? trustedDevice.trim() : null,
        ipBinding,
        trustedIp: ipBinding ? trustedIp.trim() : null,
      });
      setSecurityInfo(updated);
      setSecurityMessage("Политика безопасности устройства/сети успешно применена");
      setTimeout(() => setShowSecurityModal(false), 900);
    } catch (err) {
      setSecurityMessage(String(err));
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="has-tab-content">
      {/* ========================================================
          SECURITY STATUS BAR
          ======================================================== */}
      <div className={`has-security-banner ${canManage ? "active" : "restricted"}`}>
        <div className="has-sec-info">
          <div className="has-sec-badge-row">
            <span className="has-role-pill admin">
              Роль: Главный Администратор (Режим редактирования активен)
            </span>
            {securityInfo?.device_binding_enabled && (
              <span className={`has-sec-tag ${securityInfo.is_device_allowed ? "ok" : "err"}`}>
                Привязка к устройству: {securityInfo.is_device_allowed ? "Авторизовано" : "Ограничено"}
              </span>
            )}
            {securityInfo?.ip_binding_enabled && (
              <span className={`has-sec-tag ${securityInfo.is_ip_allowed ? "ok" : "err"}`}>
                Привязка к IP: {securityInfo.is_ip_allowed ? "Разрешено" : "Ограничено"}
              </span>
            )}
          </div>
          <div className="has-sec-details">
            <span>Устройство: <strong>{securityInfo?.current_device_name || "Определение..."}</strong></span>
            <span>Сеть/IP: <strong>{securityInfo?.current_ip || "127.0.0.1"}</strong></span>
          </div>
          {!canManage && (
            <div className="has-sec-warning">
              Внимание: редактирование заблокировано политикой безопасности доверенного устройства или IP.
            </div>
          )}
        </div>

        <button
          type="button"
          className="has-sec-settings-btn"
          onClick={() => setShowSecurityModal(true)}
        >
          Безопасность доступа (ПК / IP)
        </button>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div style={{
          padding: "12px 18px",
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: 10,
          color: "#065f46",
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 16,
        }}>
          {successNotice}
        </div>
      )}

      {/* ========================================================
          USERS TABLE PANEL
          ======================================================== */}
      <div className="has-panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 className="has-card-title" style={{ margin: 0 }}>
              Список пользователей сервера
            </h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0 0" }}>
              Актуальные учетные записи из таблицы PostgreSQL (всего: {users.length})
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {users.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenEdit(users[0])}
                className="has-btn-primary-action"
                title="Редактировать выбранного пользователя"
              >
                Редактировать пользователя
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="has-refresh-btn"
              title="Обновить список"
            >
              {isLoading ? "Загрузка..." : "Обновить"}
            </button>
          </div>
        </div>

        <div className="has-users-table-wrap">
          <table className="has-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя пользователя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Дата регистрации</th>
                <th>Статус</th>
                <th style={{ textAlign: "center" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                    Загрузка пользователей из базы данных...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                    Пользователи в базе данных не найдены
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = u.email.toLowerCase() === currentUser.email.toLowerCase();
                  return (
                    <tr key={u.id || u.email}>
                      <td style={{ color: "#64748b", fontWeight: 500 }}>#{u.id}</td>
                      <td style={{ fontWeight: 600 }}>
                        {u.username?.trim() || "—"}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={u.role === "Администратор" || u.role === "admin" ? "has-badge-admin" : "has-badge-gray"}>
                          {u.role === "admin" ? "Администратор" : u.role}
                        </span>
                      </td>
                      <td style={{ color: "#64748b", fontSize: 13 }}>{u.created_at}</td>
                      <td>
                        {isCurrent ? (
                          <span className="has-badge-green">Вы (текущий)</span>
                        ) : (
                          <span className="has-badge-gray">Активен</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="has-action-buttons" style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            className="has-btn-edit"
                            onClick={() => handleOpenEdit(u)}
                            title="Редактировать данные пользователя"
                          >
                            Редактировать
                          </button>
                          {u.id !== 1 && !isCurrent && (
                            <button
                              type="button"
                              className="has-btn-delete"
                              onClick={() => setDeletingUser(u)}
                              title="Удалить пользователя"
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          EDIT USER MODAL
          ======================================================== */}
      {editingUser && (
        <div className="has-modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="has-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">Редактирование пользователя #{editingUser.id}</h3>
            <p className="has-modal-subtitle">
              Изменение данных для <strong>{editingUser.email}</strong>
            </p>

            {editError && <div className="has-modal-error">{editError}</div>}

            <div className="has-modal-field">
              <label>Имя пользователя (Никнейм)</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Введите никнейм..."
              />
            </div>

            <div className="has-modal-field">
              <label>Email учетной записи</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="has-modal-field">
              <label>Роль в системе</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                <option value="user">Пользователь (Обычный доступ)</option>
                <option value="admin">Администратор (Полные права)</option>
              </select>
            </div>

            <div className="has-modal-field">
              <label>Новый пароль (оставьте пустым, если не меняется)</label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="has-modal-actions">
              <button
                type="button"
                className="has-modal-btn-cancel"
                onClick={() => setEditingUser(null)}
                disabled={savingEdit}
              >
                Отмена
              </button>
              <button
                type="button"
                className="has-modal-btn-save"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SECURITY POLICY MODAL
          ======================================================== */}
      {showSecurityModal && (
        <div className="has-modal-backdrop" onClick={() => setShowSecurityModal(false)}>
          <div className="has-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title">Безопасность панели администратора</h3>
            <p className="has-modal-subtitle">
              Ограничение прав редактирования по доверенному компьютеру и IP сети
            </p>

            {securityMessage && (
              <div style={{ padding: "8px 12px", background: "#f0fdf4", color: "#166534", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {securityMessage}
              </div>
            )}

            <div className="has-sec-row-toggle">
              <label className="has-sec-toggle-label">
                <input
                  type="checkbox"
                  checked={deviceBinding}
                  onChange={(e) => setDeviceBinding(e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Привязка к устройству (ПК)</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Редактирование разрешено только с доверенного компьютера
                  </div>
                </div>
              </label>
            </div>

            {deviceBinding && (
              <div className="has-modal-field" style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>Доверенное устройство</label>
                  <button
                    type="button"
                    className="has-link-btn"
                    onClick={() => setTrustedDevice(securityInfo?.current_device_name || "")}
                  >
                    Вставить текущее ({securityInfo?.current_device_name})
                  </button>
                </div>
                <input
                  type="text"
                  value={trustedDevice}
                  onChange={(e) => setTrustedDevice(e.target.value)}
                  placeholder="Имя ПК/хоста..."
                />
              </div>
            )}

            <div className="has-sec-row-toggle" style={{ marginTop: 14 }}>
              <label className="has-sec-toggle-label">
                <input
                  type="checkbox"
                  checked={ipBinding}
                  onChange={(e) => setIpBinding(e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Привязка к IP-адресу сети</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Доступ к админ-панели только из доверенной подсети или IP
                  </div>
                </div>
              </label>
            </div>

            {ipBinding && (
              <div className="has-modal-field" style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>Доверенный IP адрес</label>
                  <button
                    type="button"
                    className="has-link-btn"
                    onClick={() => setTrustedIp(securityInfo?.current_ip || "")}
                  >
                    Вставить текущий ({securityInfo?.current_ip})
                  </button>
                </div>
                <input
                  type="text"
                  value={trustedIp}
                  onChange={(e) => setTrustedIp(e.target.value)}
                  placeholder="Например: 192.168.1.100"
                />
              </div>
            )}

            <div className="has-modal-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="has-modal-btn-cancel"
                onClick={() => setShowSecurityModal(false)}
                disabled={savingPolicy}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="has-modal-btn-save"
                onClick={handleSaveSecurityPolicy}
                disabled={savingPolicy}
              >
                {savingPolicy ? "Сохранение..." : "Применить защиту"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CONFIRM DELETE MODAL
          ======================================================== */}
      {deletingUser && (
        <div className="has-modal-backdrop" onClick={() => setDeletingUser(null)}>
          <div className="has-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="has-modal-title" style={{ color: "#dc2626" }}>Удаление пользователя</h3>
            <p className="has-modal-subtitle">
              Вы уверены, что хотите навсегда удалить пользователя <strong>{deletingUser.email}</strong>? Это действие нельзя отменить.
            </p>

            <div className="has-modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="has-modal-btn-cancel"
                onClick={() => setDeletingUser(null)}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                className="has-modal-btn-delete"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
