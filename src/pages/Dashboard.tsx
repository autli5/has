import React from "react";
import type { UserDto, DbStatus, SafeDbInfo } from "../types";

interface DashboardProps {
  user: UserDto;
  dbInfo: SafeDbInfo | null;
  dbStatus: DbStatus | null;
  onLogout: () => void;
}

export default function Dashboard({
  user,
  dbInfo,
  dbStatus,
  onLogout,
}: DashboardProps) {
  return (
    <main className="dashboard-container">
      <div className="dashboard-card">
        <div className="dashboard-avatar">
          <span style={{ fontSize: 28, fontWeight: 700 }}>
            {user.email.charAt(0).toUpperCase()}
          </span>
        </div>

        <h2 className="dashboard-title">
          Добро пожаловать
        </h2>

        <p className="dashboard-subtitle">
          {user.email}
        </p>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-item-label">
              Статус сессии
            </div>
            <div
              className="info-item-value"
              style={{ color: "#10b981" }}
            >
              ● Авторизован
            </div>
          </div>

          <div className="info-item">
            <div className="info-item-label">
              Сервер PostgreSQL
            </div>
            <div className="info-item-value">
              {dbInfo?.host || dbStatus?.host || "Удаленный хост"}
            </div>
          </div>

          <div className="info-item">
            <div className="info-item-label">
              База данных
            </div>
            <div className="info-item-value">
              {dbInfo?.dbname || "postgres"}
            </div>
          </div>

          <div className="info-item">
            <div className="info-item-label">
              Таблица пользователей
            </div>
            <div className="info-item-value">
              {dbInfo?.users_table || "users"}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={onLogout}
        >
          Выйти из аккаунта
        </button>
      </div>
    </main>
  );
}
