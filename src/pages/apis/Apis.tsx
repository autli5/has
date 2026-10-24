import type { SafeDbInfo } from "../../types";
import "./Apis.css";

interface ApisProps {
  dbInfo?: SafeDbInfo | null;
  isUserAdmin?: boolean;
}

export default function Apis({ isUserAdmin = true }: ApisProps) {
  if (!isUserAdmin) {
    return (
      <div className="has-tab-content">
        <div className="has-panel-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h2 style={{ color: "#ef4444", marginBottom: "12px", fontSize: "20px" }}>Доступ ограничен</h2>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>
            Просмотр системных API и конфигурации подключений доступен только администраторам.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="has-tab-content">
      <div className="has-panel-card">
        <h3 className="has-card-title">API и подключения</h3>
        <p className="has-apis-hint">
          Эндпоинты для интеграции внешних сервисов с сервером Home Autli:
        </p>
        <div className="has-details-list">
          <div className="has-detail-row">
            <span className="has-detail-key">Эндпоинт базы данных:</span>
            <span className="has-detail-val has-mono-val">
              Внутренний шлюз (порт изолирован фаерволом)
            </span>
          </div>
          <div className="has-detail-row">
            <span className="has-detail-key">Служба SMTP:</span>
            <span className="has-detail-val has-mono-val">
              smtp.mail.ru:465 (SSL/TLS)
            </span>
          </div>
          <div className="has-detail-row">
            <span className="has-detail-key">URL автообновлений:</span>
            <span className="has-detail-val has-mono-val">
              https://github.com/autli5/has/releases/latest/download/latest.json
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
