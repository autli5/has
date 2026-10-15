import { useState } from "react";
import type { UserDto, DbStatus, SafeDbInfo } from "../types";
import logoUrl from "../assets/logo.png";
import {
  HomeNavIcon,
  TasksNavIcon,
  UsersNavIcon,
  ApiNavIcon,
  CreditCardIcon,
  SettingsNavIcon,
  HelpNavIcon,
  SearchIcon,
  LogOutIcon,
  CheckCircleIcon,
  DatabaseIcon,
} from "../components/Icons";

interface DashboardProps {
  user: UserDto;
  dbInfo: SafeDbInfo | null;
  dbStatus: DbStatus | null;
  onLogout: () => void;
}

type NavTab = "home" | "tasks" | "users" | "apis" | "subscription" | "settings" | "help";

export default function Dashboard({
  user,
  dbInfo,
  dbStatus,
  onLogout,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [searchQuery, setSearchQuery] = useState("");

  const displayName = user.username?.trim() || user.email.split("@")[0];

  return (
    <div className="has-dashboard-wrapper">
      {/* ========================================================
          LEFT SIDEBAR NAVIGATION
          ======================================================== */}
      <aside className="has-sidebar">
        {/* Brand Header */}
        <div className="has-sidebar-brand">
          <img src={logoUrl} alt="HAS Logo" className="has-brand-logo-img" />
          <span className="has-brand-name">HAS</span>
        </div>

        {/* Search Input Bar */}
        <div className="has-search-container">
          <div className="has-search-icon">
            <SearchIcon className="w-4 h-4" width={16} height={16} />
          </div>
          <input
            type="text"
            className="has-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Navigation Items */}
        <nav className="has-nav-menu">
          <button
            type="button"
            className={`has-nav-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <div className="has-nav-item-left">
              <HomeNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Home</span>
            </div>
            <span className="has-nav-badge home-badge">10</span>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <div className="has-nav-item-left">
              <TasksNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Tasks</span>
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <div className="has-nav-item-left">
              <UsersNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Users</span>
            </div>
            <span className="has-nav-badge users-badge">2</span>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "apis" ? "active" : ""}`}
            onClick={() => setActiveTab("apis")}
          >
            <div className="has-nav-item-left">
              <ApiNavIcon className="w-5 h-5" width={20} height={20} />
              <span>APIs</span>
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "subscription" ? "active" : ""}`}
            onClick={() => setActiveTab("subscription")}
          >
            <div className="has-nav-item-left">
              <CreditCardIcon className="w-5 h-5" width={20} height={20} />
              <span>Subscription</span>
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <div className="has-nav-item-left">
              <SettingsNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Settings</span>
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "help" ? "active" : ""}`}
            onClick={() => setActiveTab("help")}
          >
            <div className="has-nav-item-left">
              <HelpNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Help & Support</span>
            </div>
          </button>
        </nav>

        {/* Spacer to push user info to the bottom */}
        <div className="has-sidebar-spacer" />

        {/* User Card at Bottom: No avatar, No role, Prominent Name, and Logout */}
        <div className="has-user-card-bottom">
          <div className="has-user-meta">
            <span className="has-user-fullname" title={user.email}>
              {displayName}
            </span>
          </div>
          <button
            type="button"
            className="has-logout-btn"
            onClick={onLogout}
            title="Выйти из аккаунта"
            aria-label="Выйти"
          >
            <LogOutIcon className="w-5 h-5" width={20} height={20} />
          </button>
        </div>
      </aside>

      {/* ========================================================
          MAIN CONTENT VIEW AREA
          ======================================================== */}
      <main className="has-main-content">
        {/* Top Header Row */}
        <header className="has-content-header">
          <div>
            <h1 className="has-header-title">
              {activeTab === "home" && "Home Overview"}
              {activeTab === "tasks" && "Tasks Management"}
              {activeTab === "users" && "User Directory"}
              {activeTab === "apis" && "API Endpoints"}
              {activeTab === "subscription" && "Subscription & Resources"}
              {activeTab === "settings" && "System Settings"}
              {activeTab === "help" && "Help & Support"}
            </h1>
            <p className="has-header-subtitle">
              Home Autli Server • PostgreSQL: {dbInfo?.host || dbStatus?.host || "80.237.77.141"}
            </p>
          </div>

          <div className={`has-status-tag ${dbStatus?.connected ? "connected" : "warning"}`}>
            <span className="has-status-indicator" />
            <span>{dbStatus?.connected ? "PostgreSQL подключен" : "Проверка связи..."}</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="has-content-body">
          {activeTab === "home" && (
            <div className="has-tab-content">
              {/* Welcome Card */}
              <div className="has-welcome-banner">
                <div className="has-banner-text">
                  <h2>Здравствуйте, {displayName}!</h2>
                  <p>
                    Добро пожаловать в панель управления Home Autli Server. Все системные службы работают в штатном режиме.
                  </p>
                </div>
              </div>

              {/* Server Stats Grid */}
              <div className="has-stats-grid">
                <div className="has-stat-box">
                  <div className="has-stat-icon-wrap" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                    <DatabaseIcon className="w-5 h-5" width={20} height={20} />
                  </div>
                  <div>
                    <div className="has-stat-label">База данных</div>
                    <div className="has-stat-value">{dbInfo?.dbname || "has"}</div>
                    <div className="has-stat-hint">{dbInfo?.host || "80.237.77.141"}:5432</div>
                  </div>
                </div>

                <div className="has-stat-box">
                  <div className="has-stat-icon-wrap" style={{ background: "#ecfdf5", color: "#10b981" }}>
                    <CheckCircleIcon className="w-5 h-5" width={20} height={20} />
                  </div>
                  <div>
                    <div className="has-stat-label">Статус сервера</div>
                    <div className="has-stat-value" style={{ color: "#059669" }}>
                      {dbStatus?.connected ? "Онлайн" : "Ожидание"}
                    </div>
                    <div className="has-stat-hint">SSL: {dbInfo?.ssl_mode || "prefer"}</div>
                  </div>
                </div>

                <div className="has-stat-box">
                  <div className="has-stat-icon-wrap" style={{ background: "#f5f3ff", color: "#8b5cf6" }}>
                    <TasksNavIcon className="w-5 h-5" width={20} height={20} />
                  </div>
                  <div>
                    <div className="has-stat-label">Активные задачи</div>
                    <div className="has-stat-value">10</div>
                    <div className="has-stat-hint">Все процессы в норме</div>
                  </div>
                </div>

                <div className="has-stat-box">
                  <div className="has-stat-icon-wrap" style={{ background: "#fff7ed", color: "#ea580c" }}>
                    <UsersNavIcon className="w-5 h-5" width={20} height={20} />
                  </div>
                  <div>
                    <div className="has-stat-label">Пользователи</div>
                    <div className="has-stat-value">2</div>
                    <div className="has-stat-hint">Таблица {dbInfo?.users_table || "users"}</div>
                  </div>
                </div>
              </div>

              {/* Info Detail Card */}
              <div className="has-panel-card">
                <h3 className="has-card-title">Параметры сессии и учетной записи</h3>
                <div className="has-details-list">
                  <div className="has-detail-row">
                    <span className="has-detail-key">Имя пользователя:</span>
                    <span className="has-detail-val">{displayName}</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Email:</span>
                    <span className="has-detail-val">{user.email}</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Хост базы данных:</span>
                    <span className="has-detail-val">{dbInfo?.host || "80.237.77.141"}</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Таблица учетных записей:</span>
                    <span className="has-detail-val">{dbInfo?.users_table || "users"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="has-tab-content">
              <div className="has-panel-card">
                <h3 className="has-card-title">Системные задачи</h3>
                <div className="has-tasks-list">
                  <div className="has-task-item">
                    <div className="has-task-info">
                      <span className="has-task-name">Синхронизация данных PostgreSQL</span>
                      <span className="has-task-time">Автоматически каждые 15 минут</span>
                    </div>
                    <span className="has-task-badge status-active">Выполняется</span>
                  </div>
                  <div className="has-task-item">
                    <div className="has-task-info">
                      <span className="has-task-name">Проверка целостности файлового хранилища</span>
                      <span className="has-task-time">Ежедневно в 03:00</span>
                    </div>
                    <span className="has-task-badge status-done">Завершено</span>
                  </div>
                  <div className="has-task-item">
                    <div className="has-task-info">
                      <span className="has-task-name">Мониторинг обновлений Home Autli Server</span>
                      <span className="has-task-time">Фоновый процесс</span>
                    </div>
                    <span className="has-task-badge status-done">Активно</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="has-tab-content">
              <div className="has-panel-card">
                <h3 className="has-card-title">Список пользователей сервера</h3>
                <div className="has-users-table-wrap">
                  <table className="has-users-table">
                    <thead>
                      <tr>
                        <th>Пользователь</th>
                        <th>Email</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600 }}>{displayName}</td>
                        <td>{user.email}</td>
                        <td><span className="has-badge-green">Текущий пользователь</span></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Администратор</td>
                        <td>uj3v230o@has</td>
                        <td><span className="has-badge-gray">Системный</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "apis" && (
            <div className="has-tab-content">
              <div className="has-panel-card">
                <h3 className="has-card-title">API и подключения</h3>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
                  Эндпоинты для интеграции внешних сервисов с сервером Home Autli:
                </p>
                <div className="has-details-list">
                  <div className="has-detail-row">
                    <span className="has-detail-key">PostgreSQL Endpoint:</span>
                    <span className="has-detail-val" style={{ fontFamily: "monospace" }}>
                      postgres://uj3v230o:****@80.237.77.141:5432/has
                    </span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">SMTP Service:</span>
                    <span className="has-detail-val" style={{ fontFamily: "monospace" }}>
                      smtp.mail.ru:465 (SSL/TLS)
                    </span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Auto-Updater URL:</span>
                    <span className="has-detail-val" style={{ fontFamily: "monospace" }}>
                      https://github.com/autli5/has/releases/latest/download/latest.json
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "subscription" && (
            <div className="has-tab-content">
              <div className="has-panel-card">
                <h3 className="has-card-title">Ресурсы сервера</h3>
                <div className="has-details-list">
                  <div className="has-detail-row">
                    <span className="has-detail-key">Серверный тариф:</span>
                    <span className="has-detail-val">Dedicated VPS Server</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Адрес VPS:</span>
                    <span className="has-detail-val">80.237.77.141</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">СУБД:</span>
                    <span className="has-detail-val">PostgreSQL 16.x</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Выделенное хранилище:</span>
                    <span className="has-detail-val">Неограниченно</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="has-tab-content">
              <div className="has-panel-card">
                <h3 className="has-card-title">Настройки системы</h3>
                <div className="has-settings-group">
                  <div className="has-setting-item">
                    <div>
                      <div className="has-setting-title">Автоматическая проверка обновлений</div>
                      <div className="has-setting-desc">Уведомлять при выпуске новых версий Home Autli Server</div>
                    </div>
                    <span className="has-badge-green">Включено</span>
                  </div>
                  <div className="has-setting-item">
                    <div>
                      <div className="has-setting-title">Защита учетных записей</div>
                      <div className="has-setting-desc">Шифрование паролей алгоритмом bcrypt (cost 10)</div>
                    </div>
                    <span className="has-badge-green">Активно</span>
                  </div>
                  <div className="has-setting-item">
                    <div>
                      <div className="has-setting-title">Восстановление доступа</div>
                      <div className="has-setting-desc">Отправка 6-значных проверочных кодов через SMTP</div>
                    </div>
                    <span className="has-badge-green">Настроено</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "help" && (
            <div className="has-tab-content">
              <div className="has-panel-card">
                <h3 className="has-card-title">Помощь и поддержка</h3>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
                  Если у вас возникли вопросы по работе Home Autli Server:
                </p>
                <div className="has-details-list">
                  <div className="has-detail-row">
                    <span className="has-detail-key">Email разработчика:</span>
                    <span className="has-detail-val">scorporation@internet.ru</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Репозиторий проекта:</span>
                    <span className="has-detail-val">github.com/autli5/has</span>
                  </div>
                  <div className="has-detail-row">
                    <span className="has-detail-key">Версия приложения:</span>
                    <span className="has-detail-val">v0.1.0 (Tauri 2 + React)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
