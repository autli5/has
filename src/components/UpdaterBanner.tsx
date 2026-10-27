import { useState, useEffect, useCallback } from "react";
import { playTvBeep } from "../utils/tvAudio";

interface UpdateInfo {
  version: string;
  body: string | null;
}

interface UpdaterBannerProps {
  isTvEnvironment?: boolean;
}

// Helper for Smart TV / Android TV detection
const detectTvEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("has_tv_mode");
  if (saved !== null) return saved === "true";
  const ua = (navigator.userAgent || "").toLowerCase();
  const isTvUa =
    ua.includes("android tv") ||
    ua.includes("smarttv") ||
    ua.includes("googletv") ||
    ua.includes("tizen") ||
    ua.includes("webos") ||
    ua.includes("appletv") ||
    ua.includes("crkey") ||
    ua.includes("bravia") ||
    ua.includes("aftt") ||
    ua.includes("aftm") ||
    ua.includes("mibox") ||
    ua.includes("mi box") ||
    ua.includes("shield") ||
    ua.includes("dtv") ||
    ua.includes("smart-tv") ||
    ua.includes("hbbtv") ||
    ua.includes("netcast") ||
    ua.includes("viera") ||
    ua.includes("roku") ||
    ua.includes("firetv");
  if (isTvUa) return true;
  const isAndroid = ua.includes("android");
  const noTouch = !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
  if (isAndroid && noTouch) return true;
  return false;
};

export function UpdaterBanner({ isTvEnvironment }: UpdaterBannerProps = {}) {
  const [isTv, setIsTv] = useState<boolean>(() => isTvEnvironment ?? detectTvEnvironment());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Strictly two buttons for TV remote navigation: "update" | "skip"
  const [tvFocusedBtn, setTvFocusedBtn] = useState<"update" | "skip">("update");

  useEffect(() => {
    if (typeof isTvEnvironment === "boolean") {
      setIsTv(isTvEnvironment);
    }
  }, [isTvEnvironment]);

  // Check for updates
  useEffect(() => {
    let cancelled = false;

    const checkForUpdates = async () => {
      // 1. Try official Tauri updater plugin first (Desktop)
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check();
          if (!cancelled && update?.available) {
            setUpdateAvailable(true);
            setUpdateInfo({
              version: update.version,
              body: update.body ?? null,
            });
            setDismissed(false);
            return;
          }
        } catch (err) {
          console.warn("[Updater] Plugin check fallback:", err);
        }
      }

      // 2. Fallback check for Android TV / browser via releases endpoint
      try {
        const resp = await fetch("https://github.com/autli5/has/releases/latest/download/latest.json");
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled && data?.version && data.version !== "0.0.10") {
            setUpdateAvailable(true);
            setUpdateInfo({
              version: data.version,
              body: data.notes || data.body || "Новое обновление с улучшенной стабильностью и функциями.",
            });
            setDismissed(false);
          }
        }
      } catch {}
    };

    // 1. Initial check after startup
    const timer = setTimeout(checkForUpdates, 1000);

    // 2. Periodic check every 60 seconds
    const interval = setInterval(checkForUpdates, 60 * 1000);

    // 3. Check whenever window gains focus
    const handleFocus = () => checkForUpdates();
    window.addEventListener("focus", handleFocus);

    // 4. Custom event for manual checks from UI or simulation
    window.addEventListener("has-check-update", handleFocus);

    const handleSimulateUpdate = (e: any) => {
      setUpdateAvailable(true);
      setUpdateInfo({
        version: e.detail?.version || "1.0.0",
        body: e.detail?.body || "Вышло масштабное обновление программы: оптимизация для Android TV, автопереключение плееров и синхронизация.",
      });
      setDismissed(false);
    };
    window.addEventListener("has-simulate-update", handleSimulateUpdate);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("has-check-update", handleFocus);
      window.removeEventListener("has-simulate-update", handleSimulateUpdate);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    setDownloading(true);
    setError(null);
    setProgress(0);

    // Desktop Tauri plugin install
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const { relaunch } = await import("@tauri-apps/plugin-process");

        const update = await check();
        if (update?.available) {
          let downloaded = 0;
          let total = 0;

          await update.downloadAndInstall((event: any) => {
            if (event.event === "Started") {
              total = event.data?.contentLength ?? 0;
            } else if (event.event === "Progress") {
              downloaded += event.data?.chunkLength ?? 0;
              if (total > 0) {
                setProgress(Math.round((downloaded / total) * 100));
              }
            } else if (event.event === "Finished") {
              setProgress(100);
            }
          });

          await relaunch();
          return;
        }
      } catch (e: unknown) {
        console.warn("[Updater] Desktop updater failed, falling back to download:", e);
      }
    }

    // Fallback for Android TV / browser: animated progress and open download
    let p = 0;
    const progressTimer = setInterval(() => {
      p += 15;
      if (p >= 100) {
        clearInterval(progressTimer);
        setProgress(100);
        setTimeout(async () => {
          try {
            const { openUrl } = await import("@tauri-apps/plugin-opener");
            await openUrl("https://github.com/autli5/has/releases/latest");
          } catch {
            window.open("https://github.com/autli5/has/releases/latest", "_blank");
          }
          setDismissed(true);
          setDownloading(false);
        }, 600);
      } else {
        setProgress(p);
      }
    }, 250);
  }, []);

  // Strict Remote Control D-Pad Navigation for TV Update Modal
  // "рабочие две кнопки чтобы можно было переключаться только между ними
  // эти две кнопки написанные кнопка обновить и кнопка пропустить"
  useEffect(() => {
    if (!updateAvailable || dismissed || !isTv || downloading) return;

    const handleTvKeyDown = (e: KeyboardEvent) => {
      // Toggle strictly between "update" and "skip" on Left / Right / Up / Down / Tab
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.keyCode === 21 ||
        e.keyCode === 22 ||
        e.keyCode === 19 ||
        e.keyCode === 20 ||
        e.key === "Tab"
      ) {
        e.preventDefault();
        setTvFocusedBtn((prev) => (prev === "update" ? "skip" : "update"));
        playTvBeep(520, 0.025);
        return;
      }

      // Enter / OK (KeyCode 13, 23, 66)
      if (e.key === "Enter" || e.key === " " || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66) {
        e.preventDefault();
        if (tvFocusedBtn === "update") {
          playTvBeep(680, 0.05);
          handleInstall();
        } else {
          playTvBeep(420, 0.04);
          setDismissed(true);
        }
        return;
      }

      // Back / Escape key triggers "skip"
      if (e.key === "Escape" || e.keyCode === 27 || e.keyCode === 4) {
        e.preventDefault();
        playTvBeep(420, 0.04);
        setDismissed(true);
      }
    };

    window.addEventListener("keydown", handleTvKeyDown);
    return () => window.removeEventListener("keydown", handleTvKeyDown);
  }, [updateAvailable, dismissed, isTv, downloading, tvFocusedBtn, handleInstall]);

  if (!updateAvailable || dismissed) return null;

  // =========================================================================
  // 1. ANDROID TV: Full-screen Centered Modal with EXACTLY Two Buttons
  // =========================================================================
  if (isTv) {
    return (
      <div className="has-tv-updater-overlay" role="dialog" aria-modal="true">
        <div className="has-tv-updater-card">
          <div className="has-tv-updater-icon-ring">🚀</div>
          <h2 className="has-tv-updater-title">Доступно обновление</h2>
          <div className="has-tv-updater-version-tag">
            <span>Вышла новая версия v{updateInfo?.version || "1.0.0"}</span>
          </div>

          <p className="has-tv-updater-desc">
            {updateInfo?.body ||
              "Вышло новое обновление программы с оптимизацией для Android TV, автопереключением плееров и синхронизацией истории."}
          </p>

          {downloading ? (
            <div className="has-tv-updater-progress-container">
              <div className="has-tv-updater-progress-track">
                <div
                  className="has-tv-updater-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="has-tv-updater-progress-text">
                Загрузка и установка обновления: {progress}%
              </span>
            </div>
          ) : (
            <div className="has-tv-updater-buttons">
              {/* Button 1: Обновить */}
              <button
                type="button"
                className={`has-tv-updater-btn btn-update ${
                  tvFocusedBtn === "update" ? "focused" : ""
                }`}
                onClick={() => {
                  playTvBeep(680, 0.05);
                  handleInstall();
                }}
                onMouseEnter={() => setTvFocusedBtn("update")}
                tabIndex={0}
              >
                <span>🚀 Обновить</span>
              </button>

              {/* Button 2: Пропустить */}
              <button
                type="button"
                className={`has-tv-updater-btn btn-skip ${
                  tvFocusedBtn === "skip" ? "focused" : ""
                }`}
                onClick={() => {
                  playTvBeep(420, 0.04);
                  setDismissed(true);
                }}
                onMouseEnter={() => setTvFocusedBtn("skip")}
                tabIndex={0}
              >
                <span>Пропустить</span>
              </button>
            </div>
          )}

          {error && <div className="updater-error" style={{ marginTop: 16 }}>{error}</div>}

          <div className="has-tv-updater-remote-hint">
            ◄ ► Стрелки на пульте: переключение • OK: подтвердить выбор • Back: пропустить
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. DESKTOP: Classic Bottom-Right Popup Banner
  // =========================================================================
  return (
    <div className="updater-banner">
      <div className="updater-banner-content">
        <div className="updater-icon">🚀</div>
        <div className="updater-text">
          <strong>Доступно обновление v{updateInfo?.version}</strong>
          {updateInfo?.body && (
            <span className="updater-notes">{updateInfo.body}</span>
          )}
        </div>
        <div className="updater-actions">
          {downloading ? (
            <div className="updater-progress-wrap">
              <div className="updater-progress-bar">
                <div
                  className="updater-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="updater-progress-label">{progress}%</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="updater-btn-install"
                onClick={handleInstall}
              >
                Обновить сейчас
              </button>
              <button
                type="button"
                className="updater-btn-dismiss"
                onClick={() => setDismissed(true)}
              >
                Позже
              </button>
            </>
          )}
        </div>
      </div>
      {error && <div className="updater-error">{error}</div>}
    </div>
  );
}
