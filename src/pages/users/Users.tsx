import type { UserDto } from "../../types";
import "./Users.css";

interface UsersProps {
  user: UserDto;
  displayName: string;
}

export default function Users({ user, displayName }: UsersProps) {
  return (
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
  );
}
