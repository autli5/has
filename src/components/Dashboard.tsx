import React, { useState } from "react";
import { UserDto, DbStatus, SafeDbInfo } from "../types";
import {
  HomeNavIcon,
  TasksNavIcon,
  UsersNavIcon,
  ApiNavIcon,
  SettingsNavIcon,
  HelpNavIcon,
  LogOutIcon,
  SlidersIcon,
  UploadIcon,
  SearchIcon,
  ChevronRightIcon,
  FolderIcon,
  SortArrowsIcon,
  DatabaseIcon,
} from "./Icons";

interface DashboardProps {
  currentUser: UserDto;
  dbStatus: DbStatus | null;
  dbInfo: SafeDbInfo | null;
  onLogout: () => void;
  onOpenDbModal: () => void;
}

interface FileItem {
  id: string;
  name: string;
  size: string;
  type: "folder" | "file";
  modified: string;
  permissions: { color: string; initial: string }[];
  extraPermissions?: number;
}

const initialFiles: FileItem[] = [
  {
    id: "1",
    name: "Изображения",
    size: "3.8 GB",
    type: "folder",
    modified: "2026/10/14",
    permissions: [
      { color: "#3b82f6", initial: "A" },
      { color: "#10b981", initial: "N" },
      { color: "#f59e0b", initial: "K" },
    ],
    extraPermissions: 3,
  },
  {
    id: "2",
    name: "GIF-файлы",
    size: "7.2 MB",
    type: "folder",
    modified: "2026/10/14",
    permissions: [
      { color: "#ec4899", initial: "M" },
      { color: "#8b5cf6", initial: "D" },
      { color: "#06b6d4", initial: "S" },
    ],
  },
  {
    id: "3",
    name: "Мемы",
    size: "881 MB",
    type: "folder",
    modified: "2026/10/14",
    permissions: [
      { color: "#6366f1", initial: "O" },
      { color: "#10b981", initial: "V" },
    ],
    extraPermissions: 3,
  },
  {
    id: "4",
    name: "Видео",
    size: "1.25 GB",
    type: "folder",
    modified: "2026/10/13",
    permissions: [
      { color: "#3b82f6", initial: "R" },
      { color: "#ef4444", initial: "E" },
      { color: "#8b5cf6", initial: "L" },
    ],
    extraPermissions: 3,
  },
  {
    id: "5",
    name: "Документы",
    size: "1.2 TB",
    type: "folder",
    modified: "2026/10/12",
    permissions: [
      { color: "#14b8a6", initial: "T" },
      { color: "#f97316", initial: "Y" },
      { color: "#6366f1", initial: "P" },
    ],
    extraPermissions: 3,
  },
  {
    id: "6",
    name: "Облако",
    size: "115 KB",
    type: "folder",
    modified: "2026/10/10",
    permissions: [
      { color: "#84cc16", initial: "C" },
      { color: "#0ea5e9", initial: "B" },
    ],
  },
  {
    id: "7",
    name: "Работа",
    size: "100 KB",
    type: "folder",
    modified: "2026/10/08",
    permissions: [
      { color: "#f43f5e", initial: "W" },
      { color: "#a855f7", initial: "J" },
      { color: "#3b82f6", initial: "H" },
    ],
    extraPermissions: 3,
  },
  {
    id: "8",
    name: "Важное",
    size: "1.18 GB",
    type: "folder",
    modified: "2026/10/01",
    permissions: [
      { color: "#eab308", initial: "I" },
      { color: "#6366f1", initial: "Z" },
      { color: "#10b981", initial: "Q" },
      { color: "#ec4899", initial: "X" },
    ],
  },
];

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  dbStatus,
  onLogout,
  onOpenDbModal,
}) => {
  const [activeNav, setActiveNav] = useState("home");
  const [activeView, setActiveView] = useState<"tab" | "grid" | "list">("list");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [filesSearch, setFilesSearch] = useState("");
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [selectedIds, setSelectedIds] = useState<string[]>(["1", "3", "5"]);

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map((f) => f.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDelete = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(filesSearch.toLowerCase().trim())
  );

  const navItems = [
    { id: "home", label: "Главная", icon: HomeNavIcon, badge: 10 },
    { id: "tasks", label: "Задачи", icon: TasksNavIcon },
    { id: "users", label: "Пользователи", icon: UsersNavIcon, badge: 2 },
    { id: "apis", label: "APIs", icon: ApiNavIcon },
    { id: "settings", label: "Настройки", icon: SettingsNavIcon },
    { id: "help", label: "Помощь и поддержка", icon: HelpNavIcon },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(sidebarSearch.toLowerCase().trim())
  );

  const userInitial = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : "U";
  const userName = currentUser.email.split("@")[0];

  return (
    <div className="layout-container">
      {/* LEFT SIDEBAR */}
      <aside className="layout-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <span className="brand-letter">S</span>
          </div>
          <span className="brand-title">Home Autli Server</span>
        </div>

        {/* Sidebar Search */}
        <div className="sidebar-search-wrap">
          <SearchIcon className="sidebar-search-icon" />
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Поиск..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
          />
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setActiveNav(item.id)}
              >
                <div className="nav-item-left">
                  <Icon className="nav-item-icon" />
                  <span className="nav-item-label">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`nav-item-badge ${isActive ? "active-badge" : ""}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Card (Without Pro/Subscription Upsell) */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar-circle">
              <span>{userInitial}</span>
            </div>
            <div className="user-info-text">
              <span className="user-display-name" title={currentUser.email}>
                {userName}
              </span>
              <span className="user-role-label">Пользователь</span>
            </div>
            <button
              type="button"
              className="logout-icon-btn"
              onClick={onLogout}
              title="Выйти из аккаунта"
            >
              <LogOutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="layout-main">
        {/* TOP HEADER */}
        <header className="main-header">
          {/* Breadcrumbs */}
          <div className="header-breadcrumbs">
            <button
              type="button"
              className="breadcrumb-home-btn"
              onClick={() => setActiveNav("home")}
              title="На главную"
            >
              <HomeNavIcon className="w-4 h-4 text-indigo-600" />
            </button>
            <ChevronRightIcon className="breadcrumb-separator" />
            <span className="breadcrumb-item">Главная</span>
            <ChevronRightIcon className="breadcrumb-separator" />
            <span className="breadcrumb-item">Файловый менеджер</span>
            <ChevronRightIcon className="breadcrumb-separator" />
            <span className="breadcrumb-item active">Мои файлы</span>
          </div>

          {/* Right Header Controls */}
          <div className="header-right-controls">
            {/* Database status button */}
            <button
              type="button"
              className={`db-pill ${dbStatus?.connected ? "connected" : "error"}`}
              onClick={onOpenDbModal}
              title="Статус подключения к PostgreSQL"
            >
              <span className="db-dot"></span>
              <DatabaseIcon className="w-3.5 h-3.5" />
              <span>{dbStatus?.connected ? "БД подключена" : "БД: Ошибка"}</span>
            </button>

            <button
              type="button"
              className="header-icon-btn"
              title="Параметры фильтрации"
            >
              <SlidersIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="header-icon-btn"
              title="Настройки"
              onClick={() => setActiveNav("settings")}
            >
              <SettingsNavIcon className="w-4 h-4" />
            </button>
            <div className="header-avatar-circle" title={currentUser.email}>
              <span>{userInitial}</span>
            </div>
          </div>
        </header>

        {/* PAGE TITLE & ACTION ROW */}
        <div className="page-title-row">
          <h1 className="page-heading">Мои файлы</h1>
          <button
            type="button"
            className="btn-upload-file"
            onClick={() => {
              alert("Выберите файлы для загрузки на сервер.");
            }}
          >
            <span>Загрузить файл</span>
            <UploadIcon className="w-4 h-4" />
          </button>
        </div>

        {/* VIEW SWITCHER & SEARCH ROW */}
        <div className="content-toolbar">
          <div className="view-switch-group">
            <button
              type="button"
              className={`view-btn ${activeView === "tab" ? "active" : ""}`}
              onClick={() => setActiveView("tab")}
            >
              Вкладки
            </button>
            <button
              type="button"
              className={`view-btn ${activeView === "grid" ? "active" : ""}`}
              onClick={() => setActiveView("grid")}
            >
              Сетка
            </button>
            <button
              type="button"
              className={`view-btn ${activeView === "list" ? "active" : ""}`}
              onClick={() => setActiveView("list")}
            >
              Список
            </button>
          </div>

          <div className="table-search-wrap">
            <input
              type="text"
              className="table-search-input"
              placeholder="Поиск файлов..."
              value={filesSearch}
              onChange={(e) => setFilesSearch(e.target.value)}
            />
            <SearchIcon className="table-search-icon" />
          </div>
        </div>

        {/* FILES TABLE CONTAINER */}
        <div className="table-card">
          <table className="files-table">
            <thead>
              <tr>
                <th className="col-checkbox">
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={
                      files.length > 0 && selectedIds.length === files.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="col-name">
                  <div className="th-content">
                    <span>Имя файла</span>
                    <SortArrowsIcon className="sort-icon" />
                  </div>
                </th>
                <th className="col-size">
                  <div className="th-content">
                    <span>Размер</span>
                    <SortArrowsIcon className="sort-icon" />
                  </div>
                </th>
                <th className="col-perm">
                  <div className="th-content">
                    <span>Доступ</span>
                    <SortArrowsIcon className="sort-icon" />
                  </div>
                </th>
                <th className="col-modified">
                  <div className="th-content">
                    <span>Дата изменения</span>
                    <SortArrowsIcon className="sort-icon" />
                  </div>
                </th>
                <th className="col-actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <tr
                    key={file.id}
                    className={`file-row ${isSelected ? "selected-row" : ""}`}
                  >
                    <td className="col-checkbox">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(file.id)}
                      />
                    </td>
                    <td className="col-name">
                      <div className="file-name-cell">
                        <FolderIcon className="folder-icon" />
                        <span className="file-name-text">{file.name}</span>
                      </div>
                    </td>
                    <td className="col-size">{file.size}</td>
                    <td className="col-perm">
                      <div className="avatar-stack">
                        {file.permissions.map((p, idx) => (
                          <div
                            key={idx}
                            className="perm-avatar"
                            style={{ backgroundColor: p.color }}
                            title={`Пользователь ${p.initial}`}
                          >
                            <span>{p.initial}</span>
                          </div>
                        ))}
                        {file.extraPermissions && (
                          <div className="perm-avatar extra-badge">
                            <span>+{file.extraPermissions}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="col-modified">{file.modified}</td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="action-btn-delete"
                        onClick={() => handleDelete(file.id)}
                      >
                        Удалить
                      </button>
                      <button
                        type="button"
                        className="action-btn-edit"
                        onClick={() => {
                          const newName = prompt("Новое имя папки:", file.name);
                          if (newName && newName.trim()) {
                            setFiles((prev) =>
                              prev.map((f) =>
                                f.id === file.id
                                  ? { ...f, name: newName.trim() }
                                  : f
                              )
                            );
                          }
                        }}
                      >
                        Изменить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-files-cell">
                    Файлы не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM STORAGE PROGRESS BAR (WITHOUT PRO / BUY SPACE UPSELL) */}
        <div className="storage-footer-bar">
          <div className="storage-text-row">
            <span className="storage-label">
              <strong>Использовано места:</strong> 17.2 GB из 20 GB
            </span>
            <span className="storage-percent">80%</span>
          </div>
          <div className="storage-progress-track">
            <div className="storage-progress-fill" style={{ width: "80%" }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
