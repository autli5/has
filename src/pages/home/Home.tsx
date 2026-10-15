import type { UserDto, DbStatus, SafeDbInfo } from "../../types";
import {
  DatabaseIcon,
  CheckCircleIcon,
  TasksNavIcon,
  UsersNavIcon,
} from "../../components/Icons";
import "./Home.css";

interface HomeProps {
  user: UserDto;
  displayName: string;
  dbInfo: SafeDbInfo | null;
  dbStatus: DbStatus | null;
  usersCount: number;
}

export default function Home({
  user,
  displayName,
  dbInfo,
  dbStatus,
  usersCount,
}: HomeProps) {
  return (
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
            <div className="has-stat-label">Службы сервера</div>
            <div className="has-stat-value" style={{ color: dbStatus?.connected ? "#059669" : "#64748b" }}>
              {dbStatus?.connected ? "Активны" : "Ожидание"}
            </div>
            <div className="has-stat-hint">PostgreSQL, Auth, Mail</div>
          </div>
        </div>

        <div className="has-stat-box">
          <div className="has-stat-icon-wrap" style={{ background: "#fff7ed", color: "#ea580c" }}>
            <UsersNavIcon className="w-5 h-5" width={20} height={20} />
          </div>
          <div>
            <div className="has-stat-label">Пользователи</div>
            <div className="has-stat-value">{usersCount}</div>
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
  );
}
