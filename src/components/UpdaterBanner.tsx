import { useState, useEffect } from "react";

interface UpdateInfo {
  version: string;
  body: string | null;
}

export function UpdaterBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    let cancelled = false;

    const checkForUpdates = async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!cancelled && update?.available) {
          setUpdateAvailable(true);
          setUpdateInfo({
            version: update.version,
            body: update.body ?? null,
          });
        }
      } catch (err) {
        console.warn("[Updater] Check failed:", err);
      }
    };

    const timer = setTimeout(checkForUpdates, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

    setDownloading(true);
    setError(null);
    setProgress(0);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      const update = await check();
      if (!update?.available) return;

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
    } catch (e: unknown) {
      setError(`Ошибка обновления: ${e instanceof Error ? e.message : String(e)}`);
      setDownloading(false);
    }
  };

  if (!updateAvailable || dismissed) return null;

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
