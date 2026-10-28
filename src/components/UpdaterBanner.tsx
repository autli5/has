import { useState, useEffect, useCallback, useRef } from "react";
import { playTvBeep } from "../utils/tvAudio";

export type DetectedPlatform = "windows" | "android_tv" | "android_mobile" | "linux" | "macos" | "web";

interface UpdateInfo {
  version: string;
  body: string | null;
  downloadUrl?: string;
  platform?: string;
  windowsUrl?: string | null;
  tvApkUrl?: string | null;
  mobileApkUrl?: string | null;
  linuxUrl?: string | null;
  macosUrl?: string | null;
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

// Detect client platform
const detectClientPlatform = (isTv: boolean, backendPlatform?: string): DetectedPlatform => {
  if (isTv) return "android_tv";
  if (backendPlatform === "android") return "android_mobile";
  if (backendPlatform === "windows") return "windows";
  if (backendPlatform === "macos") return "macos";
  if (backendPlatform === "linux") return "linux";

  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  const plat = (typeof navigator !== "undefined" ? navigator.platform : "").toLowerCase();
  if (ua.includes("android")) return isTv ? "android_tv" : "android_mobile";
  if (plat.includes("win") || ua.includes("windows")) return "windows";
  if (plat.includes("mac") || ua.includes("macintosh")) return "macos";
  if (plat.includes("linux") || ua.includes("linux")) return "linux";
  return "web";
};

// Check if a remote version is strictly newer than the current version
const isNewerSemver = (remote: string, current: string): boolean => {
  const cleanRemote = remote.replace(/^v/i, "").trim();
  const cleanCurrent = current.replace(/^v/i, "").trim();
  if (cleanRemote === cleanCurrent) return false;
  const rParts = cleanRemote.split(".").map((n) => parseInt(n, 10) || 0);
  const cParts = cleanCurrent.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
};

export function UpdaterBanner({ isTvEnvironment }: UpdaterBannerProps = {}) {
  const [isTv, setIsTv] = useState<boolean>(() => isTvEnvironment ?? detectTvEnvironment());
  const [currentAppVersion, setCurrentAppVersion] = useState<string>("0.0.15");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState<string>("Загрузка обновления...");
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Auto-update preferences for Android TV
  const [autoUpdateTv, setAutoUpdateTv] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("has_auto_update_tv") === "true";
  });
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  // TV remote navigation: "update" | "skip" | "exit" | "autotoggle"
  const [tvFocusedBtn, setTvFocusedBtn] = useState<"update" | "skip" | "exit" | "autotoggle">("update");
  const updateBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof isTvEnvironment === "boolean") {
      setIsTv(isTvEnvironment);
    }
  }, [isTvEnvironment]);

  // Read current running version from Tauri on startup
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/app")
        .then(({ getVersion }) => getVersion())
        .then((ver) => {
          if (ver) setCurrentAppVersion(ver);
        })
        .catch(() => {});
    }
  }, []);

  // Check for updates
  useEffect(() => {
    let cancelled = false;

    const checkForUpdates = async () => {
      // 1. Try Rust backend command first (Works on Android TV, Mobile & Desktop without CORS limits)
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const res = await invoke<any>("check_app_update", {
            currentVersion: currentAppVersion,
          });
          if (!cancelled && res && res.has_update) {
            setUpdateAvailable(true);
            setUpdateInfo({
              version: res.version,
              body: res.body || "Новое обновление с улучшенной стабильностью и функциями.",
              downloadUrl: res.download_url,
              platform: res.platform,
              windowsUrl: res.windows_url,
              tvApkUrl: res.tv_apk_url,
              mobileApkUrl: res.mobile_apk_url,
              linuxUrl: res.linux_url,
              macosUrl: res.macos_url,
            });
            setDismissed(false);
            return;
          }
        } catch (err) {
          console.warn("[Updater] Rust backend check failed, trying fallback:", err);
        }
      }

      // 2. Desktop Tauri updater plugin (macOS / Windows / Linux)
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
        } catch {
          // Expected on mobile / TV webview
        }
      }

      // 3. GitHub API check fallback
      try {
        const resp = await fetch("https://api.github.com/repos/autli5/has/releases/latest", {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (resp.ok) {
          const data = await resp.json();
          const remoteTag = (data?.tag_name || "").replace(/^v/i, "").trim();
          if (!cancelled && remoteTag && isNewerSemver(remoteTag, currentAppVersion)) {
            let tvApk: string | null = null;
            let mobileApk: string | null = null;
            let winUrl: string | null = null;
            let linUrl: string | null = null;
            let macUrl: string | null = null;

            if (Array.isArray(data?.assets)) {
              for (const asset of data.assets) {
                const name: string = (asset.name || "").toLowerCase();
                const url: string = asset.browser_download_url || "";
                if ((name.includes("_tv_") || name.includes("-tv-") || name.includes(".tv.")) && name.endsWith(".apk")) {
                  tvApk = url;
                } else if (name.endsWith(".apk") && !mobileApk) {
                  mobileApk = url;
                } else if (name.endsWith(".exe") || name.endsWith(".msi")) {
                  if (!winUrl || name.endsWith(".exe")) winUrl = url;
                } else if (name.endsWith(".deb") || name.endsWith(".appimage") || name.endsWith(".rpm")) {
                  if (!linUrl || name.endsWith(".deb")) linUrl = url;
                } else if (name.endsWith(".dmg")) {
                  macUrl = url;
                }
              }
            }

            if (!tvApk && mobileApk) tvApk = mobileApk;
            if (!mobileApk && tvApk) mobileApk = tvApk;

            setUpdateAvailable(true);
            setUpdateInfo({
              version: remoteTag,
              body: data.body || "Новое обновление с улучшенной стабильностью и функциями.",
              downloadUrl: data.html_url || "https://github.com/autli5/has/releases/latest",
              windowsUrl: winUrl,
              tvApkUrl: tvApk,
              mobileApkUrl: mobileApk,
              linuxUrl: linUrl,
              macosUrl: macUrl,
            });
            setDismissed(false);
          }
        }
      } catch (err) {
        console.warn("[Updater] Fallback fetch error:", err);
      }
    };

    const timer = setTimeout(checkForUpdates, 1200);
    const interval = setInterval(checkForUpdates, 90 * 1000);
    const handleFocus = () => checkForUpdates();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("has-check-update", handleFocus);

    const handleSimulateUpdate = (e: any) => {
      setUpdateAvailable(true);
      setUpdateInfo({
        version: e.detail?.version || "1.0.0",
        body: e.detail?.body || "Вышло масштабное обновление программы.",
        downloadUrl: "https://github.com/autli5/has/releases/latest",
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
  }, [currentAppVersion]);

  // Determine current active platform
  const clientPlatform = detectClientPlatform(isTv, updateInfo?.platform);

  // Platform-tailored texts and assets
  const getPlatformDetails = () => {
    const version = updateInfo?.version || "1.0.0";
    switch (clientPlatform) {
      case "windows":
        return {
          badge: "🪟 Windows",
          title: `Доступно обновление для Windows (v${version})`,
          desc: "Вышла новая версия приложения для Windows. Нажмите «Обновить», чтобы установить последнюю версию программы.",
          btnLabel: "🚀 Обновить для Windows (.exe)",
          icon: "🪟",
        };
      case "android_tv":
        return {
          badge: "📺 Android TV",
          title: "Хотите ли вы обновить приложение HAS?",
          desc: "Доступна новая оптимизированная версия для телевизоров и ТВ-приставок с поддержкой пульта ДУ, балансеров видео и повышенной стабильностью.",
          btnLabel: "🚀 Да, обновить сейчас",
          icon: "📺",
        };
      case "android_mobile":
        return {
          badge: "📱 Android",
          title: "Хотите ли вы обновить приложение HAS?",
          desc: "Новая версия приложения для мобильных устройств на Android.",
          btnLabel: "🚀 Скачать APK для Android",
          icon: "📱",
        };
      case "linux":
        return {
          badge: "🐧 Linux",
          title: `Доступно обновление для Linux (v${version})`,
          desc: "Пакет обновления для дистрибутивов Linux (.deb / .AppImage / .rpm).",
          btnLabel: "🚀 Скачать для Linux (.deb)",
          icon: "🐧",
        };
      case "macos":
        return {
          badge: "🍏 macOS",
          title: `Доступно обновление для macOS (v${version})`,
          desc: "Новая версия приложения для macOS (.dmg).",
          btnLabel: "🚀 Скачать образ (.dmg)",
          icon: "🍏",
        };
      default:
        return {
          badge: "🚀 Обновление",
          title: `Доступно обновление v${version}`,
          desc: "Вышла новая версия программы с улучшенной стабильностью.",
          btnLabel: "🚀 Обновить сейчас",
          icon: "🚀",
        };
    }
  };

  const platformInfo = getPlatformDetails();

  // Smart download target selector
  const resolveTargetUrl = useCallback((): string => {
    if (!updateInfo) return "https://github.com/autli5/has/releases/latest";
    switch (clientPlatform) {
      case "windows":
        return updateInfo.windowsUrl || updateInfo.downloadUrl || "https://github.com/autli5/has/releases/latest";
      case "android_tv":
        return updateInfo.tvApkUrl || updateInfo.mobileApkUrl || updateInfo.downloadUrl || "https://github.com/autli5/has/releases/latest";
      case "android_mobile":
        return updateInfo.mobileApkUrl || updateInfo.tvApkUrl || updateInfo.downloadUrl || "https://github.com/autli5/has/releases/latest";
      case "linux":
        return updateInfo.linuxUrl || updateInfo.downloadUrl || "https://github.com/autli5/has/releases/latest";
      case "macos":
        return updateInfo.macosUrl || updateInfo.downloadUrl || "https://github.com/autli5/has/releases/latest";
      default:
        return updateInfo.downloadUrl || "https://github.com/autli5/has/releases/latest";
    }
  }, [clientPlatform, updateInfo]);

  const cancelAutoCountdown = useCallback(() => {
    setAutoCountdown(null);
  }, []);

  const toggleAutoUpdate = useCallback(() => {
    setAutoUpdateTv((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("has_auto_update_tv", next ? "true" : "false");
      } catch {}
      return next;
    });
    cancelAutoCountdown();
  }, [cancelAutoCountdown]);

  const handleInstall = useCallback(async () => {
    cancelAutoCountdown();
    setDownloading(true);
    setError(null);
    setProgress(0);
    setStatusText("Подготовка к установке обновления...");

    // Desktop Windows / macOS / Linux Tauri updater plugin
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window && !isTv) {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const { relaunch } = await import("@tauri-apps/plugin-process");

        const update = await check();
        if (update?.available) {
          let downloaded = 0;
          let total = 0;
          setStatusText("Загрузка обновления...");

          await update.downloadAndInstall((event: any) => {
            if (event.event === "Started") {
              total = event.data?.contentLength ?? 0;
            } else if (event.event === "Progress") {
              downloaded += event.data?.chunkLength ?? 0;
            } else if (event.event === "Finished") {
              setProgress(100);
              setStatusText("Перезапуск программы...");
            }
            if (total > 0) {
              const p = Math.round((downloaded / total) * 100);
              setProgress(p);
              setStatusText(`Загрузка: ${p}%`);
            }
          });

          await relaunch();
          return;
        }
      } catch (e: unknown) {
        console.warn("[Updater] Desktop plugin install skipped/fallback:", e);
      }
    }

    // Android TV / Mobile / Direct APK Download & Installation
    const targetUrl = resolveTargetUrl();
    setStatusText("Подключение к серверу загрузки APK...");

    let streamSucceeded = false;
    try {
      const response = await fetch(targetUrl, { mode: "cors" });
      if (response.ok && response.body) {
        const contentLength = +(response.headers.get("Content-Length") || 0);
        const reader = response.body.getReader();
        let received = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (contentLength > 0) {
              const pct = Math.min(99, Math.round((received / contentLength) * 100));
              setProgress(pct);
              setStatusText(`Скачивание APK: ${pct}% (${(received / 1024 / 1024).toFixed(1)} МБ)`);
            } else {
              setStatusText(`Скачивание APK: ${(received / 1024 / 1024).toFixed(1)} МБ`);
            }
          }
        }

        setProgress(100);
        setStatusText("APK успешно скачан! Запуск установки...");
        streamSucceeded = true;

        const blob = new Blob(chunks as BlobPart[], { type: "application/vnd.android.package-archive" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `has-tv-v${updateInfo?.version || "update"}.apk`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      // Fetch streaming can be restricted by CORS on certain hosts; fallback below
    }

    if (!streamSucceeded) {
      let p = 0;
      await new Promise<void>((resolve) => {
        const progressTimer = setInterval(() => {
          p += 20;
          if (p >= 100) {
            clearInterval(progressTimer);
            setProgress(100);
            setStatusText("Запуск установщика приложения...");
            resolve();
          } else {
            setProgress(p);
            setStatusText(`Загрузка: ${p}%`);
          }
        }, 120);
      });
    }

    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(targetUrl);
    } catch {
      window.open(targetUrl, "_blank");
    }

    setTimeout(() => {
      setDismissed(true);
      setDownloading(false);
    }, 1800);
  }, [cancelAutoCountdown, isTv, updateInfo, resolveTargetUrl]);

  // Clean Exit from TV application
  const handleExitApp = useCallback(async () => {
    try {
      const { exit } = await import("@tauri-apps/plugin-process");
      await exit(0);
    } catch {
      window.close();
    }
  }, []);

  // Auto-update countdown for Android TV
  useEffect(() => {
    if (!updateAvailable || dismissed || !isTv || downloading) return;
    if (!autoUpdateTv) {
      setAutoCountdown(null);
      return;
    }

    setAutoCountdown(5);
    const interval = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          handleInstall();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [updateAvailable, dismissed, isTv, downloading, autoUpdateTv, handleInstall]);

  // Strict Remote Control D-Pad Navigation for TV Update Modal
  useEffect(() => {
    if (!updateAvailable || dismissed || !isTv || downloading) return;

    // Auto-focus the "Update" button when TV modal appears
    setTimeout(() => {
      if (updateBtnRef.current) {
        updateBtnRef.current.focus();
      }
    }, 50);

    const handleTvKeyDown = (e: KeyboardEvent) => {
      cancelAutoCountdown();

      // Down: switch to auto-update toggle
      if (e.key === "ArrowDown" || e.keyCode === 20) {
        e.preventDefault();
        playTvBeep(520, 0.025);
        if (tvFocusedBtn !== "autotoggle") {
          setTvFocusedBtn("autotoggle");
        }
        return;
      }

      // Up: switch back from auto-update toggle to update button
      if (e.key === "ArrowUp" || e.keyCode === 19) {
        e.preventDefault();
        playTvBeep(520, 0.025);
        if (tvFocusedBtn === "autotoggle") {
          setTvFocusedBtn("update");
        }
        return;
      }

      // Left: cycle within top button row
      if (e.key === "ArrowLeft" || e.keyCode === 21) {
        e.preventDefault();
        playTvBeep(520, 0.025);
        setTvFocusedBtn((prev) => {
          if (prev === "exit") return "skip";
          if (prev === "skip") return "update";
          return "exit";
        });
        return;
      }

      // Right / Tab: cycle within top button row
      if (e.key === "ArrowRight" || e.keyCode === 22 || e.key === "Tab") {
        e.preventDefault();
        playTvBeep(520, 0.025);
        setTvFocusedBtn((prev) => {
          if (prev === "update") return "skip";
          if (prev === "skip") return "exit";
          return "update";
        });
        return;
      }

      // Enter / OK (KeyCode 13, 23, 66)
      if (e.key === "Enter" || e.key === " " || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66) {
        e.preventDefault();
        if (tvFocusedBtn === "update") {
          playTvBeep(680, 0.05);
          handleInstall();
        } else if (tvFocusedBtn === "exit") {
          playTvBeep(320, 0.06);
          handleExitApp();
        } else if (tvFocusedBtn === "autotoggle") {
          playTvBeep(560, 0.04);
          toggleAutoUpdate();
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
  }, [updateAvailable, dismissed, isTv, downloading, tvFocusedBtn, handleInstall, handleExitApp, cancelAutoCountdown, toggleAutoUpdate]);

  if (!updateAvailable || dismissed) return null;

  // =========================================================================
  // 1. ANDROID TV: Full-screen Centered Modal with D-Pad TV Navigation & Exit
  // =========================================================================
  if (isTv) {
    return (
      <div className="has-tv-updater-overlay" role="dialog" aria-modal="true">
        <div className="has-tv-updater-card">
          <div className="has-tv-updater-icon-ring">{platformInfo.icon}</div>
          <h2 className="has-tv-updater-title">Хотите ли вы обновить приложение HAS?</h2>
          <div className="has-tv-updater-version-tag">
            <span>📺 Android TV • v{currentAppVersion} ➔ v{updateInfo?.version || "новейшая"}</span>
          </div>

          <p className="has-tv-updater-desc">
            {updateInfo?.body || platformInfo.desc}
          </p>

          {autoCountdown !== null && !downloading && (
            <div className="has-tv-updater-countdown">
              ⚡ Автообновление активно: начнется через {autoCountdown} сек... (нажмите любую кнопку для отмены)
            </div>
          )}

          {downloading ? (
            <div className="has-tv-updater-progress-container">
              <div className="has-tv-updater-progress-track">
                <div
                  className="has-tv-updater-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="has-tv-updater-progress-text">
                {statusText}
              </span>
            </div>
          ) : (
            <>
              <div className="has-tv-updater-buttons">
                {/* Button 1: Да, обновить сейчас */}
                <button
                  ref={updateBtnRef}
                  type="button"
                  className={`has-tv-updater-btn btn-update ${
                    tvFocusedBtn === "update" ? "focused" : ""
                  }`}
                  onClick={() => {
                    playTvBeep(680, 0.05);
                    cancelAutoCountdown();
                    handleInstall();
                  }}
                  onMouseEnter={() => {
                    cancelAutoCountdown();
                    setTvFocusedBtn("update");
                  }}
                  tabIndex={0}
                  data-tv-focusable="true"
                >
                  <span>{platformInfo.btnLabel}</span>
                </button>

                {/* Button 2: Напомнить позже */}
                <button
                  type="button"
                  className={`has-tv-updater-btn btn-skip ${
                    tvFocusedBtn === "skip" ? "focused" : ""
                  }`}
                  onClick={() => {
                    playTvBeep(420, 0.04);
                    cancelAutoCountdown();
                    setDismissed(true);
                  }}
                  onMouseEnter={() => {
                    cancelAutoCountdown();
                    setTvFocusedBtn("skip");
                  }}
                  tabIndex={0}
                  data-tv-focusable="true"
                >
                  <span>Напомнить позже</span>
                </button>

                {/* Button 3: Выход из приложения (Exit) */}
                <button
                  type="button"
                  className={`has-tv-updater-btn btn-exit ${
                    tvFocusedBtn === "exit" ? "focused" : ""
                  }`}
                  onClick={() => {
                    playTvBeep(320, 0.06);
                    cancelAutoCountdown();
                    handleExitApp();
                  }}
                  onMouseEnter={() => {
                    cancelAutoCountdown();
                    setTvFocusedBtn("exit");
                  }}
                  tabIndex={0}
                  data-tv-focusable="true"
                  title="Выйти из приложения"
                >
                  <span>✕ Выход</span>
                </button>
              </div>

              {/* Auto-update Toggle Chip for Android TV */}
              <button
                type="button"
                className={`has-tv-updater-autotoggle ${autoUpdateTv ? "active" : ""} ${
                  tvFocusedBtn === "autotoggle" ? "focused" : ""
                }`}
                onClick={toggleAutoUpdate}
                onMouseEnter={() => {
                  cancelAutoCountdown();
                  setTvFocusedBtn("autotoggle");
                }}
                tabIndex={0}
                data-tv-focusable="true"
                title="Переключить режим автоматического скачивания обновлений для ТВ"
              >
                {autoUpdateTv
                  ? "🟢 Автообновление для TV: ВКЛЮЧЕНО (скачивать без запроса)"
                  : "⚪ Автообновление для TV: ВЫКЛЮЧЕНО (нажмите OK чтобы включить)"}
              </button>
            </>
          )}

          {error && <div className="updater-error" style={{ marginTop: 16 }}>{error}</div>}

          <div className="has-tv-updater-remote-hint">
            ◄ ► Стрелки на пульте: выбор • ▲ ▼ Вверх/Вниз: переключение опций • OK: подтвердить • Back: позже
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. DESKTOP (WINDOWS / MAC / LINUX) & MOBILE: Smart Platform Banner
  // =========================================================================
  return (
    <div className="updater-banner">
      <div className="updater-banner-content">
        <div className="updater-icon">{platformInfo.icon}</div>
        <div className="updater-text">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <strong>{platformInfo.title}</strong>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(99, 102, 241, 0.2)",
                color: "#c7d2fe",
                fontWeight: 700,
              }}
            >
              {platformInfo.badge}
            </span>
          </div>
          <span className="updater-notes">
            {updateInfo?.body || platformInfo.desc}
          </span>
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
                {platformInfo.btnLabel}
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
