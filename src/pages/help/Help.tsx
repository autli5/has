import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import "./Help.css";

export default function Help() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("v0.1.7");

  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      getVersion()
        .then((v) => setAppVersion(`v${v}`))
        .catch(() => {});
    }
  }, []);

  const handleManualCheck = () => {
    setChecking(true);
    setStatus("Проверка серверов обновлений...");
    window.dispatchEvent(new CustomEvent("has-check-update"));
    setTimeout(() => {
      setChecking(false);
      setStatus("Проверка завершена. Если доступна новая версия, появится баннер обновления вверху экрана.");
    }, 2500);
  };

  return (
    <div className="has-tab-content">
      <div className="has-panel-card">
        <h3 className="has-card-title">Помощь и поддержка</h3>
        <p className="has-help-intro">
          Если у вас возникли вопросы по работе Home Autli Server:
        </p>
        <div className="has-details-list">
          <div className="has-detail-row">
            <span className="has-detail-key">Email разработчика:</span>
            <span className="has-detail-val">scorporation@internet.ru</span>
          </div>
          <div className="has-detail-row">
            <span className="has-detail-key">Репозиторий проекта:</span>
            <span className="has-detail-val">github.com/autli5/has</span>
          </div>
          <div className="has-detail-row">
            <span className="has-detail-key">Версия приложения:</span>
            <span className="has-detail-val">{appVersion} (Tauri 2 + React)</span>
          </div>
          <div className="has-detail-row" style={{ marginTop: "14px" }}>
            <button
              type="button"
              className="has-btn-primary"
              onClick={handleManualCheck}
              disabled={checking}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                borderRadius: "8px",
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {checking ? "⏳ Проверка..." : "🔄 Проверить обновления сейчас"}
            </button>
          </div>
          {status && (
            <div style={{ marginTop: "8px", fontSize: "12.5px", color: "#94a3b8" }}>
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
