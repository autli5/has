import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import logoUrl from "../assets/logo.png";
import type { UserDto, AuthResponse } from "../types";
import { playTvBeep, playTvSelectBeep, playTvBackBeep, playTvErrorBeep } from "../utils/tvAudio";
import "./TvProfileSelector.css";

interface TvProfileSelectorProps {
  onSelectProfile: (user: UserDto) => void;
  onSwitchToDesktop?: () => void;
}

const STORAGE_KEY = "has_tv_saved_profiles";

export const TvProfileSelector: React.FC<TvProfileSelectorProps> = ({
  onSelectProfile,
  onSwitchToDesktop,
}) => {
  const [profiles, setProfiles] = useState<UserDto[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Fallback: check if standard remembered user exists
      const rem = localStorage.getItem("has_remembered_user");
      if (rem) {
        const parsedUser = JSON.parse(rem);
        if (parsedUser?.email) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([parsedUser]));
          return [parsedUser];
        }
      }
    } catch {}
    return [];
  });

  // Focus state on arc: either a profile index or the central "+" button
  const [focusState, setFocusState] = useState<{ type: "profile"; index: number } | { type: "plus" }>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && JSON.parse(saved).length > 0) {
          return { type: "profile", index: 0 };
        }
      } catch {}
      return { type: "plus" };
    }
  );

  // 3-button TV Authorization Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [tvEmail, setTvEmail] = useState("");
  const [tvPassword, setTvPassword] = useState("");
  const [tvLoginFocus, setTvLoginFocus] = useState<0 | 1 | 2>(0); // 0: Email, 1: Password, 2: Submit
  const [tvLoading, setTvLoading] = useState(false);
  const [tvError, setTvError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  // Synchronize focus when modal opens
  useEffect(() => {
    if (isLoginModalOpen) {
      setTvLoginFocus(0);
      setTvError(null);
      setTimeout(() => emailInputRef.current?.focus(), 60);
    }
  }, [isLoginModalOpen]);

  // Handle focus changes in login modal
  useEffect(() => {
    if (!isLoginModalOpen) return;
    if (tvLoginFocus === 0) {
      emailInputRef.current?.focus();
    } else if (tvLoginFocus === 1) {
      passwordInputRef.current?.focus();
    } else if (tvLoginFocus === 2) {
      submitButtonRef.current?.focus();
    }
  }, [tvLoginFocus, isLoginModalOpen]);

  // Compute profile coordinates on the arc (matching the user's sketch)
  const getCoordinates = (index: number, total: number) => {
    const cx = 440;
    const cy = 360;
    const rx = 330;
    const ry = 210;

    if (total === 1) {
      return { x: cx, y: cy - ry };
    }

    // Distribute angles along the semicircle arc
    const startAngle = (155 * Math.PI) / 180;
    const endAngle = (25 * Math.PI) / 180;
    const step = (startAngle - endAngle) / (total - 1);
    const angle = startAngle - index * step;

    const x = cx + rx * Math.cos(angle);
    const y = cy - ry * Math.sin(angle);
    return { x, y };
  };

  // Login handler for 3-button TV login
  const handleTvLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTvError(null);

    const cleanEmail = tvEmail.trim();
    if (!cleanEmail || !tvPassword) {
      setTvError("Заполните почту и пароль");
      playTvBeep(320, 0.08);
      return;
    }

    setTvLoading(true);
    try {
      const res = await invoke<AuthResponse>("login", {
        email: cleanEmail,
        password: tvPassword,
      });

      if (res.success && res.user) {
        playTvBeep(780, 0.06);
        // Save to TV profiles list
        const updated = [
          res.user,
          ...profiles.filter((p) => p.email.toLowerCase() !== res.user!.email.toLowerCase()),
        ];
        setProfiles(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        localStorage.setItem("has_remembered_user", JSON.stringify(res.user));
        localStorage.setItem("has_remembered_email", cleanEmail);
        setIsLoginModalOpen(false);
        onSelectProfile(res.user);
      } else {
        setTvError(res.message || "Неверный логин или пароль");
        playTvErrorBeep();
      }
    } catch (err: any) {
      setTvError(`Ошибка: ${err?.message || err}`);
      playTvErrorBeep();
    } finally {
      setTvLoading(false);
    }
  };

  // Select profile directly from arc
  const handleSelect = (user: UserDto) => {
    playTvSelectBeep();
    localStorage.setItem("has_remembered_user", JSON.stringify(user));
    onSelectProfile(user);
  };

  // Remove profile from TV list
  const handleDeleteProfile = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    const filtered = profiles.filter((p) => p.email.toLowerCase() !== email.toLowerCase());
    setProfiles(filtered);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    setFocusState({ type: "plus" });
    playTvBackBeep();
  };

  // Global D-pad Remote Control Key Listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // ----------------------------------------------------------------------
      // CASE 1: 3-Button TV Login Modal is OPEN (Strict Remote Focus Trap)
      // "больше пультом дистанционного управления никуда нельзя будет нажать только на эти три кнопки"
      // ----------------------------------------------------------------------
      if (isLoginModalOpen) {
        // Back / Escape key returns to Profile Arc
        if (e.key === "Escape" || e.keyCode === 27 || e.keyCode === 4) {
          e.preventDefault();
          setIsLoginModalOpen(false);
          setFocusState({ type: "plus" });
          playTvBackBeep();
          return;
        }

        // Down Arrow: Email (0) -> Password (1) -> Button (2)
        if (e.key === "ArrowDown" || e.keyCode === 20) {
          e.preventDefault();
          setTvLoginFocus((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
          playTvBeep(520, 0.025);
          return;
        }

        // Up Arrow: Button (2) -> Password (1) -> Email (0)
        if (e.key === "ArrowUp" || e.keyCode === 19) {
          e.preventDefault();
          setTvLoginFocus((prev) => ((prev - 1 + 3) % 3) as 0 | 1 | 2);
          playTvBeep(520, 0.025);
          return;
        }

        // Tab / Shift+Tab cycling strictly between these 3 controls
        if (e.key === "Tab") {
          e.preventDefault();
          if (e.shiftKey) {
            setTvLoginFocus((prev) => ((prev - 1 + 3) % 3) as 0 | 1 | 2);
          } else {
            setTvLoginFocus((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
          }
          playTvBeep(520, 0.025);
          return;
        }

        // Enter / OK (KeyCode 13, 23, 66)
        if (e.key === "Enter" || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66) {
          if (tvLoginFocus === 0) {
            e.preventDefault();
            setTvLoginFocus(1);
            playTvBeep(580, 0.03);
          } else if (tvLoginFocus === 1 || tvLoginFocus === 2) {
            e.preventDefault();
            handleTvLogin();
          }
          return;
        }

        // Left / Right keys stay inside the input for text editing
        return;
      }

      // ----------------------------------------------------------------------
      // CASE 2: Arc Profile Selection Screen
      // ----------------------------------------------------------------------
      const total = profiles.length;

      // Left Arrow
      if (e.key === "ArrowLeft" || e.keyCode === 21) {
        e.preventDefault();
        if (focusState.type === "profile") {
          if (focusState.index > 0) {
            setFocusState({ type: "profile", index: focusState.index - 1 });
            playTvBeep(540, 0.025);
          }
        } else {
          // From plus button: jump to left-middle profile if exists
          if (total > 0) {
            const targetIdx = Math.max(0, Math.floor((total - 1) / 2));
            setFocusState({ type: "profile", index: targetIdx });
            playTvBeep(540, 0.025);
          }
        }
        return;
      }

      // Right Arrow
      if (e.key === "ArrowRight" || e.keyCode === 22) {
        e.preventDefault();
        if (focusState.type === "profile") {
          if (focusState.index < total - 1) {
            setFocusState({ type: "profile", index: focusState.index + 1 });
            playTvBeep(540, 0.025);
          }
        } else {
          // From plus button: jump to right-middle profile if exists
          if (total > 0) {
            const targetIdx = Math.min(total - 1, Math.ceil((total - 1) / 2));
            setFocusState({ type: "profile", index: targetIdx });
            playTvBeep(540, 0.025);
          }
        }
        return;
      }

      // Down Arrow -> moves focus to the Plus button in center
      if (e.key === "ArrowDown" || e.keyCode === 20) {
        e.preventDefault();
        if (focusState.type === "profile") {
          setFocusState({ type: "plus" });
          playTvBeep(500, 0.025);
        }
        return;
      }

      // Up Arrow -> moves focus from Plus button up to nearest profile
      if (e.key === "ArrowUp" || e.keyCode === 19) {
        e.preventDefault();
        if (focusState.type === "plus" && total > 0) {
          const targetIdx = Math.round((total - 1) / 2);
          setFocusState({ type: "profile", index: targetIdx });
          playTvBeep(560, 0.025);
        }
        return;
      }

      // OK / Enter -> Select Profile or Open Plus Login
      if (e.key === "Enter" || e.key === " " || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66) {
        e.preventDefault();
        if (focusState.type === "profile" && profiles[focusState.index]) {
          handleSelect(profiles[focusState.index]);
        } else if (focusState.type === "plus") {
          setIsLoginModalOpen(true);
          playTvBeep(640, 0.03);
        }
        return;
      }

      // Delete / Backspace key removes focused profile
      if (e.key === "Delete" || e.keyCode === 46) {
        if (focusState.type === "profile" && profiles[focusState.index]) {
          e.preventDefault();
          const p = profiles[focusState.index];
          const filtered = profiles.filter((item) => item.email.toLowerCase() !== p.email.toLowerCase());
          setProfiles(filtered);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          setFocusState({ type: "plus" });
          playTvBeep(360, 0.04);
        }
      }
    },
    [isLoginModalOpen, tvLoginFocus, focusState, profiles, tvEmail, tvPassword]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="has-tv-profile-screen">
      <div className="has-tv-profile-glow" />

      {/* Header */}
      <header className="has-tv-profile-header">
        <img src={logoUrl} alt="HAS Logo" className="has-tv-profile-logo" />
        <h1 className="has-tv-profile-title">Кто сейчас смотрит?</h1>
        <p className="has-tv-profile-subtitle">Выберите профиль для автоматического входа</p>
      </header>

      {/* Arc Stage with Semicircle & Profile Circles */}
      <div className="has-tv-arc-stage">
        {/* SVG Semicircle Arc (matching user's drawing) */}
        <svg className="has-tv-arc-svg" viewBox="0 0 880 400" preserveAspectRatio="none">
          <path d="M 110 360 A 330 210 0 0 1 770 360" className="has-tv-arc-path" />
        </svg>

        {/* Profile Avatars along the Arc */}
        {profiles.map((user, idx) => {
          const coords = getCoordinates(idx, profiles.length);
          const isFocused = focusState.type === "profile" && focusState.index === idx;

          return (
            <button
              key={`${user.email}-${idx}`}
              type="button"
              className={`has-tv-profile-node ${isFocused ? "focused" : ""}`}
              style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
              onClick={() => handleSelect(user)}
              onMouseEnter={() => setFocusState({ type: "profile", index: idx })}
              title={`Войти как ${user.username || user.email}`}
            >
              <div className="has-tv-profile-avatar-circle">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username || user.email} />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="has-tv-profile-avatar-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}

                {/* Delete badge visible on hover/focus */}
                {isFocused && (
                  <span
                    className="has-tv-profile-delete-btn"
                    onClick={(e) => handleDeleteProfile(e, user.email)}
                    title="Удалить профиль с ТВ"
                  >
                    ×
                  </span>
                )}
              </div>

              <span className="has-tv-profile-name">
                {user.username || user.email.split("@")[0]}
              </span>
              {user.role === "admin" && <span className="has-tv-profile-badge">ADMIN</span>}
            </button>
          );
        })}

        {/* Plus Button: Positioned in Center under the Arc */}
        <button
          type="button"
          className={`has-tv-plus-node ${focusState.type === "plus" ? "focused" : ""}`}
          style={{ left: "440px", top: "340px" }}
          onClick={() => {
            setIsLoginModalOpen(true);
            playTvBeep(640, 0.03);
          }}
          onMouseEnter={() => setFocusState({ type: "plus" })}
          title="Добавить новый профиль"
        >
          <div className="has-tv-plus-circle">+</div>
          <span className="has-tv-plus-label">Добавить</span>
        </button>
      </div>

      {/* Footer Navigation Hints */}
      <footer className="has-tv-profile-footer">
        <span className="has-tv-profile-hint-pill">
          ◄ ► Влево / Вправо • ▼ Кнопка + • OK Вход в аккаунт
        </span>
        {onSwitchToDesktop && (
          <button
            type="button"
            className="has-tv-profile-switch-desktop"
            onClick={onSwitchToDesktop}
          >
            💻 Обычный режим ПК
          </button>
        )}
      </footer>

      {/* ==================================================================
          STRICT 3-BUTTON TV LOGIN MODAL
          "два поля почта и пароль с кнопкой входа больше пультом дистанционного
          управления никуда нельзя будет нажать только на эти три кнопки"
          ================================================================== */}
      {isLoginModalOpen && (
        <div
          className="has-tv-login-overlay"
          onClick={() => {
            setIsLoginModalOpen(false);
            setFocusState({ type: "plus" });
          }}
        >
          <div className="has-tv-login-card" onClick={(e) => e.stopPropagation()}>
            <div className="has-tv-login-card-header">
              <h2 className="has-tv-login-card-title">Добавить профиль</h2>
              <p className="has-tv-login-card-desc">
                Введите данные для авторизации нового аккаунта на ТВ
              </p>
            </div>

            <form className="has-tv-login-form" onSubmit={handleTvLogin}>
              {/* Field 1: Email */}
              <input
                ref={emailInputRef}
                type="email"
                value={tvEmail}
                onChange={(e) => setTvEmail(e.target.value)}
                placeholder="Почта"
                className={`has-tv-login-input ${tvLoginFocus === 0 ? "focused" : ""}`}
                tabIndex={0}
                autoFocus
              />

              {/* Field 2: Password */}
              <input
                ref={passwordInputRef}
                type="password"
                value={tvPassword}
                onChange={(e) => setTvPassword(e.target.value)}
                placeholder="Пароль"
                className={`has-tv-login-input ${tvLoginFocus === 1 ? "focused" : ""}`}
                tabIndex={0}
              />

              {tvError && <div className="has-tv-login-error-banner">{tvError}</div>}

              {/* Button 3: Submit Button */}
              <button
                ref={submitButtonRef}
                type="submit"
                disabled={tvLoading}
                className={`has-tv-login-submit-btn ${tvLoginFocus === 2 ? "focused" : ""}`}
                tabIndex={0}
              >
                {tvLoading ? "Подключение..." : "Войти"}
              </button>
            </form>

            <div className="has-tv-login-card-hint">
              ▲ ▼ Пульт: перемещение • OK: выбор • Назад (Back / Esc): отмена
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
