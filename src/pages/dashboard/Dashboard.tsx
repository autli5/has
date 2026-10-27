import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserDto, DbStatus, SafeDbInfo, ServerUserDto, UserProfileDto } from "../../types";
import logoUrl from "../../assets/logo.png";
import {
  HomeNavIcon,
  UsersNavIcon,
  SettingsNavIcon,
  HelpNavIcon,
  LogOutIcon,
  ChevronLeftIcon,
  CinemaNavIcon,
  MenuIcon,
  CloseIcon,
} from "../../components/Icons";
import Home from "../home/Home";
import Users from "../users/Users";
import Settings from "../settings/Settings";
import Help from "../help/Help";
import Profile from "../profile/Profile";
import "./Dashboard.css";

const Cinema = lazy(() => import("../cinema/Cinema"));

function CinemaLoadingFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        color: "#94a3b8",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: "3px solid rgba(129, 140, 248, 0.2)",
          borderTopColor: "#818cf8",
          borderRadius: "50%",
          animation: "has-spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: 16, fontWeight: 500 }}>Загрузка Кинотеатра...</span>
    </div>
  );
}

interface DashboardProps {
  user: UserDto;
  dbInfo: SafeDbInfo | null;
  dbStatus: DbStatus | null;
  onLogout: () => void;
}

type NavTab = "cinema" | "home" | "users" | "settings" | "profile" | "help";

// Helper for Smart TV / Android TV detection
const detectTvEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("has_tv_mode");
  if (saved !== null) return saved === "true";
  const ua = (navigator.userAgent || "").toLowerCase();
  const isTvUa =
    ua.includes("android tv") ||
    ua.includes("smarttv") ||
    ua.includes("googletv") ||
    ua.includes("tizen") ||
    ua.includes("webos") ||
    ua.includes("appletv") ||
    ua.includes("crkey") ||
    ua.includes("bravia") ||
    ua.includes("aftt") ||
    ua.includes("aftm") ||
    ua.includes("mibox") ||
    ua.includes("mi box") ||
    ua.includes("shield") ||
    ua.includes("dtv") ||
    ua.includes("smart-tv") ||
    ua.includes("hbbtv") ||
    ua.includes("netcast") ||
    ua.includes("viera") ||
    ua.includes("roku") ||
    ua.includes("firetv");
  if (isTvUa) return true;
  const isAndroid = ua.includes("android");
  const noTouch = !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
  if (isAndroid && noTouch) return true;
  return false;
};

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

  const [isTvEnvironment, setIsTvEnvironment] = useState<boolean>(detectTvEnvironment);
  const [activeTab, setActiveTab] = useState<NavTab>("cinema");
  const [serverUsers, setServerUsers] = useState<ServerUserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("has_sidebar_collapsed") === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dynamic D-Pad Remote Control Key Listener (Auto-detects TV when user presses remote buttons)
  useEffect(() => {
    const handleRemoteDpadKey = (e: KeyboardEvent) => {
      const isRemoteKey =
        [19, 20, 21, 22, 23, 4, 82, 85, 179].includes(e.keyCode) ||
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (isRemoteKey && !isTvEnvironment) {
        setIsTvEnvironment(true);
        localStorage.setItem("has_tv_mode", "true");
      }
    };
    window.addEventListener("keydown", handleRemoteDpadKey);
    return () => window.removeEventListener("keydown", handleRemoteDpadKey);
  }, [isTvEnvironment]);

  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

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
              role: profile.role || prev.role,
            }));
          }
        })
        .catch((err) => {
          console.warn("Could not preload user avatar for sidebar:", err);
        });
    }
  }, [currentUser.email, isTauri]);

  // Periodic heartbeat to keep user online status updated in database
  useEffect(() => {
    if (!isTauri || !currentUser.email) return;

    const sendHeartbeat = () => {
      invoke("update_user_heartbeat", { userEmail: currentUser.email }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    window.addEventListener("focus", sendHeartbeat);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", sendHeartbeat);
    };
  }, [currentUser.email, isTauri]);

  const isUserAdmin =
    (currentUser.role || "").toLowerCase() === "admin" ||
    (currentUser.role || "").toLowerCase() === "администратор" ||
    currentUser.email.toLowerCase() === "ne60201@gmail.com" ||
    serverUsers.some(
      (u) =>
        u.email.toLowerCase() === currentUser.email.toLowerCase() &&
        (u.role?.toLowerCase() === "admin" || u.role?.toLowerCase() === "администратор" || u.id === 1)
    );

  // Non-admin redirection: users and home (server stats) tabs are reserved for admin
  useEffect(() => {
    if (!isUserAdmin && (activeTab === "users" || activeTab === "home")) {
      setActiveTab("cinema");
    }
  }, [isUserAdmin, activeTab]);

  const isCinemaView = activeTab === "cinema";

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

  useEffect(() => {
    if (activeTab === "users") {
      loadServerUsers();
    }
  }, [activeTab, loadServerUsers]);

  return (
    <div className={`has-dashboard-wrapper ${isTvEnvironment ? "has-tv-mode-root" : ""}`}>
      {/* Mobile Top Header (Visible on Mobile / Small screens) */}
      <header className="has-mobile-top-bar">
        <div
          className="has-mobile-top-brand"
          onClick={() => handleNavClick("home")}
          role="button"
          tabIndex={0}
        >
          <img src={logoUrl} alt="HAS Logo" className="has-mobile-top-logo" />
          <span className="has-mobile-top-title">HAS</span>
        </div>
        <button
          type="button"
          className="has-mobile-hamburger-btn"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          title={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
        >
          {mobileMenuOpen ? (
            <CloseIcon className="w-6 h-6" width={24} height={24} />
          ) : (
            <MenuIcon className="w-6 h-6" width={24} height={24} />
          )}
        </button>
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="has-mobile-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ========================================================
          LEFT SIDEBAR NAVIGATION (Desktop Sidebar / Mobile Drawer)
          ======================================================== */}
      <aside className={`has-sidebar ${isCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
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
          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            className="has-mobile-drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Закрыть меню"
            title="Закрыть меню"
          >
            <CloseIcon className="w-5 h-5" width={20} height={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="has-nav-menu">
          <button
            type="button"
            className={`has-nav-item ${activeTab === "cinema" ? "active" : ""}`}
            onClick={() => handleNavClick("cinema")}
            title={isCollapsed ? "Кинотеатр" : undefined}
          >
            <div className="has-nav-item-left">
              <CinemaNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Кинотеатр</span>}
            </div>
          </button>

          {isUserAdmin && (
            <button
              type="button"
              className={`has-nav-item ${activeTab === "home" ? "active" : ""}`}
              onClick={() => handleNavClick("home")}
              title={isCollapsed ? "Панель сервера" : undefined}
            >
              <div className="has-nav-item-left">
                <HomeNavIcon className="w-5 h-5" width={20} height={20} />
                {!isCollapsed && <span>Панель сервера</span>}
              </div>
            </button>
          )}

          {isUserAdmin && (
            <button
              type="button"
              className={`has-nav-item ${activeTab === "users" ? "active" : ""}`}
              onClick={() => handleNavClick("users")}
              title={isCollapsed ? `Пользователи (${serverUsers.length})` : undefined}
            >
              <div className="has-nav-item-left">
                <UsersNavIcon className="w-5 h-5" width={20} height={20} />
                {!isCollapsed && <span>Пользователи</span>}
              </div>
              {!isCollapsed && serverUsers.length > 0 && (
                <span className="has-nav-badge users-badge">{serverUsers.length}</span>
              )}
              {isCollapsed && serverUsers.length > 0 && (
                <span className="has-nav-dot" />
              )}
            </button>
          )}

          <button
            type="button"
            className={`has-nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => handleNavClick("settings")}
            title={isCollapsed ? "Настройки" : undefined}
          >
            <div className="has-nav-item-left">
              <SettingsNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Настройки</span>}
            </div>
          </button>

          <button
            type="button"
            className={`has-nav-item ${activeTab === "help" ? "active" : ""}`}
            onClick={() => handleNavClick("help")}
            title={isCollapsed ? "Помощь" : undefined}
          >
            <div className="has-nav-item-left">
              <HelpNavIcon className="w-5 h-5" width={20} height={20} />
              {!isCollapsed && <span>Помощь</span>}
            </div>
          </button>
        </nav>

        {/* Spacer to push user info to the bottom */}
        <div className="has-sidebar-spacer" />

        {/* User Card at Bottom: Clickable to open Profile */}
        <div className="has-user-card-bottom">
          <div
            className="has-sidebar-user-left-group"
            onClick={() => handleNavClick("profile")}
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
                {currentUser.bio && (
                  <span className="has-user-status-bio" title={currentUser.bio}>
                    {currentUser.bio}
                  </span>
                )}
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
      <main className={`has-main-content ${isCinemaView ? "cinema-mode" : ""}`}>
        {/* Top Header Row (Hidden on Profile and Cinema views) */}
        {!isCinemaView && activeTab !== "profile" && (
          <header className="has-content-header">
            <div>
              <h1 className="has-header-title">
                {activeTab === "home" && "Обзор сервера"}
                {activeTab === "users" && "Пользователи системы"}
                {activeTab === "settings" && "Настройки системы"}
                {activeTab === "help" && "Помощь и поддержка"}
              </h1>
              <p className="has-header-subtitle">
                Сервер Home Autli • Защищенный шлюз
              </p>
            </div>

            <div className={`has-status-tag ${dbStatus?.connected ? "connected" : "warning"}`}>
              <span className="has-status-indicator" />
              <span>{dbStatus?.connected ? "Система активна" : "Проверка связи..."}</span>
            </div>

            {isTvEnvironment && (
              <button
                type="button"
                className="has-tv-back-to-cinema-btn"
                onClick={() => handleNavClick("cinema")}
                data-tv-focusable="true"
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                🎬 Вернуться в Кинотеатр
              </button>
            )}
          </header>
        )}

        {/* Content Body Rendering Separate Page Components */}
        <div className="has-content-body">
          {activeTab === "cinema" && (
            <Suspense fallback={<CinemaLoadingFallback />}>
              <Cinema
                currentUser={currentUser}
                onNavigateTab={(tab) => handleNavClick(tab as NavTab)}
                onLogout={onLogout}
                isTvEnvironment={isTvEnvironment}
              />
            </Suspense>
          )}

          {activeTab === "home" && isUserAdmin && (
            <Home
              user={currentUser}
              displayName={displayName}
              dbInfo={dbInfo}
              dbStatus={dbStatus}
              usersCount={serverUsers.length}
            />
          )}

          {activeTab === "users" && isUserAdmin && (
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

          {activeTab === "settings" && <Settings />}

          {activeTab === "profile" && (
            <Profile
              currentUser={currentUser}
              onUpdateUser={(updated) => setCurrentUser(updated)}
              serverUsers={serverUsers}
              onRefreshUsers={loadServerUsers}
              onNavigateToUsers={() => handleNavClick("users")}
            />
          )}

          {activeTab === "help" && <Help />}
        </div>
      </main>
    </div>
  );
}
