import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserDto, DbStatus, SafeDbInfo, ServerUserDto } from "../../types";
import logoUrl from "../../assets/logo.png";
import {
  HomeNavIcon,
  StorageNavIcon,
  TasksNavIcon,
  UsersNavIcon,
  ApiNavIcon,
  SettingsNavIcon,
  HelpNavIcon,
  GitNavIcon,
  SearchIcon,
  LogOutIcon,
} from "../../components/Icons";
import Home from "../home/Home";
import Storage from "../storage/Storage";
import Git from "../git/Git";
import Tasks from "../tasks/Tasks";
import Users from "../users/Users";
import Apis from "../apis/Apis";
import Settings from "../settings/Settings";
import Help from "../help/Help";
import "./Dashboard.css";

interface DashboardProps {
  user: UserDto;
  dbInfo: SafeDbInfo | null;
  dbStatus: DbStatus | null;
  onLogout: () => void;
}

type NavTab = "home" | "storage" | "git" | "tasks" | "users" | "apis" | "settings" | "help";

export default function Dashboard({
  user,
  dbInfo,
  dbStatus,
  onLogout,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [serverUsers, setServerUsers] = useState<ServerUserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const displayName = user.username?.trim() || user.email.split("@")[0];

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const loadServerUsers = useCallback(async () => {
    if (!isTauri) return;
    setLoadingUsers(true);
    try {
      const res = await invoke<ServerUserDto[]>("list_server_users");
      if (Array.isArray(res)) {
        setServerUsers(res);
      }
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [isTauri]);

  useEffect(() => {
    loadServerUsers();
  }, [loadServerUsers]);

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
            className={`has-nav-item ${activeTab === "storage" ? "active" : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            <div className="has-nav-item-left">
              <StorageNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Storage</span>
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "git" ? "active" : ""}`}
            onClick={() => setActiveTab("git")}
          >
            <div className="has-nav-item-left">
              <GitNavIcon className="w-5 h-5" width={20} height={20} />
              <span>Git</span>
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
            {serverUsers.length > 0 && (
              <span className="has-nav-badge users-badge">{serverUsers.length}</span>
            )}
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

        {/* User Card at Bottom */}
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
              {activeTab === "storage" && "Файловое хранилище"}
              {activeTab === "tasks" && "Tasks Management"}
              {activeTab === "users" && "User Directory"}
              {activeTab === "apis" && "API Endpoints"}
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

        {/* Content Body Rendering Separate Page Components */}
        <div className="has-content-body">
          {activeTab === "home" && (
            <Home
              user={user}
              displayName={displayName}
              dbInfo={dbInfo}
              dbStatus={dbStatus}
              usersCount={serverUsers.length}
            />
          )}

          {activeTab === "storage" && <Storage currentUser={user} />}
          {activeTab === "git" && <Git user={user} />}

          {activeTab === "tasks" && <Tasks />}

          {activeTab === "users" && (
            <Users
              currentUser={{
                ...user,
                role: user.role || (user.email.toLowerCase() === "ne60201@gmail.com" ? "admin" : "user"),
              }}
              users={serverUsers}
              isLoading={loadingUsers}
              onRefresh={loadServerUsers}
            />
          )}

          {activeTab === "apis" && <Apis dbInfo={dbInfo} />}

          {activeTab === "settings" && <Settings />}

          {activeTab === "help" && <Help />}
        </div>
      </main>
    </div>
  );
}
