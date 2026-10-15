import "./Tasks.css";

export default function Tasks() {
  return (
    <div className="has-tab-content">
      <div className="has-panel-card">
        <h3 className="has-card-title">Системные задачи</h3>
        <div className="has-tasks-list">
          <div className="has-task-item">
            <div className="has-task-info">
              <span className="has-task-name">Синхронизация данных PostgreSQL</span>
              <span className="has-task-time">Автоматически каждые 15 минут</span>
            </div>
            <span className="has-task-badge status-active">Выполняется</span>
          </div>
          <div className="has-task-item">
            <div className="has-task-info">
              <span className="has-task-name">Проверка целостности файлового хранилища</span>
              <span className="has-task-time">Ежедневно в 03:00</span>
            </div>
            <span className="has-task-badge status-done">Завершено</span>
          </div>
          <div className="has-task-item">
            <div className="has-task-info">
              <span className="has-task-name">Мониторинг обновлений Home Autli Server</span>
              <span className="has-task-time">Фоновый процесс</span>
            </div>
            <span className="has-task-badge status-done">Активно</span>
          </div>
        </div>
      </div>
    </div>
  );
}
