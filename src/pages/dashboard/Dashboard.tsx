import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserDto, DbStatus, SafeDbInfo, ServerUserDto, UserProfileDto } from "../../types";
import logoUrl from "../../assets/logo.png";
import {
  HomeNavIcon,
  StorageNavIcon,
  TasksNavIcon,
  UsersNavIcon,
  ApiNavIcon,
  SettingsNavIcon,
  HelpNavIcon,
  SearchIcon,
  LogOutIcon,
  ChevronLeftIcon,
  CinemaNavIcon,
} from "../../components/Icons";
import Home from "../home/Home";
import Storage from "../storage/Storage";
import Tasks from "../tasks/Tasks";
import Users from "../users/Users";
import Apis from "../apis/Apis";
import Settings from "../settings/Settings";
import Help from "../help/Help";
import Profile from "../profile/Profile";
import Cinema from "../cinema/Cinema";
import "./Dashboard.css";

interface DashboardProps {
  user: UserDto;
  dbInfo: SafeDbInfo | null;
  dbStatus: DbStatus | null;
  onLogout: () => void;
}

type NavTab = "home" | "storage" | "cinema" | "tasks" | "users" | "apis" | "settings" | "profile" | "help";

export default function Dashboard({
  user,
  dbInfo,
  dbStatus,
  onLogout,
}: DashboardProps) {
  const [currentUser, setCurrentUser] = useState<UserDto>(user);
  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [serverUsers, setServerUsers] = useState<ServerUserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("has_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("has_sidebar_collapsed", String(next));
      return next;
    });
  };

  const displayName = currentUser.username?.trim() || currentUser.email.split("@")[0];

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  useEffect(() => {
    if (isTauri && currentUser.email) {
      invoke<UserProfileDto>("get_user_profile", { userEmail: currentUser.email })
        .then((profile) => {
          if (profile) {
            setCurrentUser((prev) => ({
              ...prev,
              username: profile.username || prev.username,
              avatar: profile.avatar !== undefined ? profile.avatar : prev.avatar,
            }));
          }
        })
        .catch((err) => {
          console.warn("Could not preload user avatar for sidebar:", err);
        });
    }
  }, [currentUser.email, isTauri]);

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
      <aside className={`has-sidebar ${isCollapsed ? "collapsed" : ""}`}>
        {/* Brand Header */}
        <div className="has-sidebar-brand">
          <button
            type="button"
            className="has-brand-logo-btn"
            onClick={toggleSidebar}
            title={isCollapsed ? "Развернуть навигацию" : "Свернуть навигацию"}
            aria-label={isCollapsed ? "Развернуть навигацию" : "Свернуть навигацию"}
          >
            <img src={logoUrl} alt="HAS Logo" className="has-brand-logo-img" />
          </button>
          {!isCollapsed && (
            <>
              <span className="has-brand-name">HAS</span>
              <button
                type="button"
                className="has-sidebar-toggle-btn"
                onClick={toggleSidebar}
                title="Свернуть меню"
                aria-label="Свернуть меню"
              >
                <ChevronLeftIcon className="w-4 h-4" width={18} height={18} />
              </button>
            </>
          )}
        </div>

        {/* Search Input Bar (only when expanded) */}
        {!isCollapsed && (
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
        )}

        {/* Navigation Items */}
        <nav className="has-nav-menu">
          <button
            type="button"
            className={`has-nav-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
            title={isCollapsed ? "Home" : undefined}
          >
            <div className="has-nav-item-left">
              <HomeNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Home</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
            title={isCollapsed ? "Tasks" : undefined}
          >
            <div className="has-nav-item-left">
              <TasksNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Tasks</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "storage" ? "active" : ""}`}
            onClick={() => setActiveTab("storage")}
            title={isCollapsed ? "Storage" : undefined}
          >
            <div className="has-nav-item-left">
              <StorageNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Storage</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "cinema" ? "active" : ""}`}
            onClick={() => setActiveTab("cinema")}
            title={isCollapsed ? "Cinema" : undefined}
          >
            <div className="has-nav-item-left">
              <CinemaNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Cinema</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
            title={isCollapsed ? `Users (${serverUsers.length})` : undefined}
          >
            <div className="has-nav-item-left">
              <UsersNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Users</span>}
            </div>
            {!isCollapsed && serverUsers.length > 0 && (
              <span className="has-nav-badge users-badge">{serverUsers.length}</span>
            )}
            {isCollapsed && serverUsers.length > 0 && (
              <span className="has-nav-dot" />
            )}
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "apis" ? "active" : ""}`}
            onClick={() => setActiveTab("apis")}
            title={isCollapsed ? "APIs" : undefined}
          >
            <div className="has-nav-item-left">
              <ApiNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>APIs</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title={isCollapsed ? "Settings" : undefined}
          >
            <div className="has-nav-item-left">
              <SettingsNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Settings</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "help" ? "active" : ""}`}
            onClick={() => setActiveTab("help")}
            title={isCollapsed ? "Help & Support" : undefined}
          >
            <div className="has-nav-item-left">
              <HelpNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Help & Support</span>}
            </div>
          </button>
        </nav>

        {/* Spacer to push user info to the bottom */}
        <div className="has-sidebar-spacer" />

        {/* User Card at Bottom: Clickable to open Profile */}
        <div className="has-user-card-bottom">
          <div
            className="has-sidebar-user-left-group"
            onClick={() => setActiveTab("profile")}
            title="Открыть профиль"
          >
            <div className="has-sidebar-user-avatar-circle" title={displayName}>
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={displayName} className="has-sidebar-user-avatar-img" />
              ) : (
                <div className="has-sidebar-user-avatar-fallback">
                  {(currentUser.username || currentUser.email || "U").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="has-user-meta">
                <span className="has-user-fullname" title={currentUser.email}>
                  {displayName}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="has-logout-btn"
            onClick={(e) => {
              e.stopPropagation();
              onLogout();
            }}
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
      <main className={`has-main-content ${activeTab === "cinema" ? "cinema-mode" : ""}`}>
        {/* Top Header Row (Hidden on Profile and Cinema tabs) */}
        {activeTab !== "profile" && activeTab !== "cinema" && (
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
        )}

        {/* Content Body Rendering Separate Page Components */}
        <div className="has-content-body">
          {activeTab === "home" && (
            <Home
              user={currentUser}
              displayName={displayName}
              dbInfo={dbInfo}
              dbStatus={dbStatus}
              usersCount={serverUsers.length}
            />
          )}

          {activeTab === "storage" && <Storage currentUser={currentUser} />}

          {activeTab === "cinema" && <Cinema currentUser={currentUser} />}

          {activeTab === "tasks" && <Tasks />}

          {activeTab === "users" && (
            <Users
              currentUser={{
                ...currentUser,
                role: currentUser.role || (currentUser.email.toLowerCase() === "ne60201@gmail.com" ? "admin" : "user"),
              }}
              users={serverUsers}
              isLoading={loadingUsers}
              onRefresh={loadServerUsers}
            />
          )}

          {activeTab === "apis" && <Apis dbInfo={dbInfo} />}

          {activeTab === "settings" && <Settings />}

          {activeTab === "profile" && (
            <Profile
              currentUser={currentUser}
              onUpdateUser={(updated) => setCurrentUser(updated)}
            />
          )}

          {activeTab === "help" && <Help />}
        </div>
      </main>
    </div>
  );
}
