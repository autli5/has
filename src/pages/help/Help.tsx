import "./Help.css";

export default function Help() {
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
            <span className="has-detail-val">v0.1.2 (Tauri 2 + React)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
