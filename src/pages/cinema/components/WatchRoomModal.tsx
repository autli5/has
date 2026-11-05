import type { WatchRoom } from "../types";

interface WatchRoomModalProps {
  show: boolean;
  activeRoom: WatchRoom | null;
  roomError: string | null;
  isRoomBusy: boolean;
  joinRoomCodeInput: string;
  watchRoomModalTab: "join" | "create";
  onClose: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code?: string) => void;
  onLeaveRoom: () => void;
  setJoinRoomCodeInput: (value: string) => void;
  setWatchRoomModalTab: (tab: "join" | "create") => void;
}

export default function WatchRoomModal({
  show,
  activeRoom,
  roomError,
  isRoomBusy,
  joinRoomCodeInput,
  watchRoomModalTab,
  onClose,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  setJoinRoomCodeInput,
  setWatchRoomModalTab,
}: WatchRoomModalProps) {
  if (!show) return null;

  return (
    <div className="has-cinema-watch-room-overlay" onClick={onClose}>
      <div className="has-cinema-watch-room-modal" onClick={(e) => e.stopPropagation()}>
        <div className="has-cinema-watch-room-header">
          <div className="has-cinema-watch-room-title-box">
            <span className="room-icon-lg">🍿</span>
            <div>
              <h3 className="has-cinema-watch-room-title">Совместный просмотр</h3>
              <p className="has-cinema-watch-room-sub">Смотрите фильмы и сериалы синхронно с друзьями</p>
            </div>
          </div>
          <button type="button" className="has-cinema-watch-room-close" onClick={onClose} data-tv-focusable="true">
            ✕
          </button>
        </div>

        {roomError && (
          <div className="has-cinema-watch-room-alert error">
            ⚠️ {roomError}
          </div>
        )}

        {activeRoom ? (
          /* Already Connected Room View */
          <div className="has-cinema-watch-room-connected">
            <div className="has-cinema-watch-room-code-card">
              <span className="code-label">КОД ВАШЕЙ КОМНАТЫ:</span>
              <span className="code-value">{activeRoom.room_code}</span>
              <p className="code-hint">Поделитесь кодом с друзьями для присоединения</p>
            </div>

            <div className="has-cinema-watch-room-info">
              <div className="info-item">
                <span className="info-icon">👤</span>
                <span className="info-text">
                  Хост: <strong>{activeRoom.host_name}</strong>
                </span>
              </div>
              <div className="info-item">
                <span className="info-icon">👥</span>
                <span className="info-text">
                  Участников: <strong>{activeRoom.participants.length}</strong>
                </span>
              </div>
              <div className="info-item">
                <span className="info-icon">🎬</span>
                <span className="info-text">
                  <strong>{activeRoom.media_title}</strong>
                </span>
              </div>
            </div>

            {activeRoom.participants.length > 0 && (
              <div className="has-cinema-watch-room-participants">
                <h4>Участники комнаты:</h4>
                <ul>
                  {activeRoom.participants.map((p) => (
                    <li key={p.user_email}>
                      {p.is_host && <span className="host-badge">👑</span>}
                      <span className="participant-name">{p.user_name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              className="has-cinema-watch-room-btn danger"
              onClick={onLeaveRoom}
              disabled={isRoomBusy}
              data-tv-focusable="true"
            >
              {isRoomBusy ? "⏳ Выход..." : "🚪 Выйти из комнаты"}
            </button>
          </div>
        ) : (
          /* Join / Create Tabs */
          <div className="has-cinema-watch-room-tabs-container">
            <div className="has-cinema-watch-room-tabs">
              <button
                type="button"
                className={`tab-btn ${watchRoomModalTab === "join" ? "active" : ""}`}
                onClick={() => setWatchRoomModalTab("join")}
                data-tv-focusable="true"
              >
                🔗 Присоединиться
              </button>
              <button
                type="button"
                className={`tab-btn ${watchRoomModalTab === "create" ? "active" : ""}`}
                onClick={() => setWatchRoomModalTab("create")}
                data-tv-focusable="true"
              >
                ➕ Создать комнату
              </button>
            </div>

            <div className="has-cinema-watch-room-tab-content">
              {watchRoomModalTab === "join" ? (
                <div className="tab-panel">
                  <p className="tab-description">
                    Введите 6-значный код комнаты, чтобы присоединиться к друзьям
                  </p>
                  <input
                    type="text"
                    className="has-cinema-watch-room-input"
                    placeholder="Введите код комнаты"
                    value={joinRoomCodeInput}
                    onChange={(e) => setJoinRoomCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    disabled={isRoomBusy}
                    data-tv-focusable="true"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && joinRoomCodeInput.trim()) {
                        onJoinRoom();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="has-cinema-watch-room-btn primary"
                    onClick={() => onJoinRoom()}
                    disabled={isRoomBusy || !joinRoomCodeInput.trim()}
                    data-tv-focusable="true"
                  >
                    {isRoomBusy ? "⏳ Подключение..." : "🔗 Войти в комнату"}
                  </button>
                </div>
              ) : (
                <div className="tab-panel">
                  <p className="tab-description">
                    Создайте новую комнату для совместного просмотра с друзьями
                  </p>
                  <div className="has-cinema-watch-room-create-info">
                    <div className="info-row">
                      <span className="info-icon">✨</span>
                      <span>Синхронизация воспроизведения в реальном времени</span>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">🎯</span>
                      <span>Автоматическая пауза для всех участников</span>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">⚡</span>
                      <span>Моментальная синхронизация перемоток</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="has-cinema-watch-room-btn primary"
                    onClick={() => onCreateRoom()}
                    disabled={isRoomBusy}
                    data-tv-focusable="true"
                  >
                    {isRoomBusy ? "⏳ Создание..." : "➕ Создать комнату"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
