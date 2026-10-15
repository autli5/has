import type { SafeDbInfo } from "../types";
import "./Apis.css";

interface ApisProps {
  dbInfo: SafeDbInfo | null;
}

export default function Apis({ dbInfo }: ApisProps) {
  return (
    <div className="has-tab-content">
      <div className="has-panel-card">
        <h3 className="has-card-title">API и подключения</h3>
        <p className="has-apis-hint">
          Эндпоинты для интеграции внешних сервисов с сервером Home Autli:
        </p>
        <div className="has-details-list">
          <div className="has-detail-row">
            <span className="has-detail-key">PostgreSQL Endpoint:</span>
            <span className="has-detail-val has-mono-val">
              postgres://{dbInfo?.user || "uj3v230o"}:****@{dbInfo?.host || "80.237.77.141"}:5432/{dbInfo?.dbname || "has"}
            </span>
          </div>
          <div className="has-detail-row">
            <span className="has-detail-key">SMTP Service:</span>
            <span className="has-detail-val has-mono-val">
              smtp.mail.ru:465 (SSL/TLS)
            </span>
          </div>
          <div className="has-detail-row">
            <span className="has-detail-key">Auto-Updater URL:</span>
            <span className="has-detail-val has-mono-val">
              https://github.com/autli5/has/releases/latest/download/latest.json
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
