import type { UserDto, ServerUserDto } from "../../types";
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
  return (
    <div className="has-tab-content">
      <div className="has-panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 className="has-card-title" style={{ margin: 0 }}>
              Список пользователей сервера
            </h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0 0" }}>
              Актуальные учетные записи из таблицы PostgreSQL (всего: {users.length})
            </p>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                    Загрузка пользователей из базы данных...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
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
                        <span className={u.role === "Администратор" ? "has-badge-admin" : "has-badge-gray"}>
                          {u.role}
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
