import "./Settings.css";

export default function Settings() {
  return (
    <div className="has-tab-content">
      <div className="has-panel-card">
        <h3 className="has-card-title">Настройки системы</h3>
        <div className="has-settings-group">
          <div className="has-setting-item">
            <div>
              <div className="has-setting-title">Автоматическая проверка обновлений</div>
              <div className="has-setting-desc">Уведомлять при выпуске новых версий Home Autli Server</div>
            </div>
            <span className="has-badge-green">Включено</span>
          </div>
          <div className="has-setting-item">
            <div>
              <div className="has-setting-title">Защита учетных записей</div>
              <div className="has-setting-desc">Шифрование паролей алгоритмом bcrypt (cost 10)</div>
            </div>
            <span className="has-badge-green">Активно</span>
          </div>
          <div className="has-setting-item">
            <div>
              <div className="has-setting-title">Восстановление доступа</div>
              <div className="has-setting-desc">Отправка 6-значных проверочных кодов через SMTP</div>
            </div>
            <span className="has-badge-green">Настроено</span>
          </div>
        </div>
      </div>
    </div>
  );
}
