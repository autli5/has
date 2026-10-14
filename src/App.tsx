import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import logoUrl from "./assets/logo.png";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightLoginIcon,
  DatabaseIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SpinnerIcon,
  ChevronLeftIcon,
} from "./components/Icons";
import { AuthResponse, DbStatus, ResetRequestResponse, SafeDbInfo, UserDto } from "./types";
import { OtpInput } from "./components/OtpInput";
import "./App.css";

const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export default function App() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Password reset state
  const [resetStage, setResetStage] = useState<1 | 2 | 3>(1);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [dbInfo, setDbInfo] = useState<SafeDbInfo | null>(null);

  const [showDbModal, setShowDbModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Check saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("has_remembered_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
      } catch {
        localStorage.removeItem("has_remembered_user");
      }
    }

    const savedEmail = localStorage.getItem("has_remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
    }

    // Check DB status on startup
    checkDatabase();
  }, []);

  // Countdown timer for OTP re-send in resetStage 2
  useEffect(() => {
    if (resetStage !== 2) return;
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resetStage]);

  const checkDatabase = async () => {
    if (!isTauri()) {
      setDbStatus({
        connected: false,
        host: "localhost",
        dbname: "postgres",
        message: "Приложение запущено в браузере. Запустите через Tauri для подключения к Postgres.",
      });
      return;
    }

    try {
      const info = await invoke<SafeDbInfo>("get_db_info");
      setDbInfo(info);

      const status = await invoke<DbStatus>("check_db");
      setDbStatus(status);
    } catch (err: any) {
      setDbStatus({
        connected: false,
        host: "unknown",
        dbname: "unknown",
        message: String(err?.message || err),
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Пожалуйста, заполните email и пароль");
      return;
    }

    if (!isTauri()) {
      setError("Для реального подключения к PostgreSQL запустите десктоп-приложение ('npm run tauri dev')");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<AuthResponse>("login", {
        email: email.trim(),
        password,
      });

      if (res.success && res.user) {
        setCurrentUser(res.user);
        if (rememberMe) {
          localStorage.setItem("has_remembered_user", JSON.stringify(res.user));
          localStorage.setItem("has_remembered_email", email.trim());
        } else {
          localStorage.removeItem("has_remembered_user");
          localStorage.removeItem("has_remembered_email");
        }
      } else {
        setError(res.message || "Ошибка входа. Проверьте данные.");
      }
    } catch (err: any) {
      setError(`Ошибка: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Пожалуйста, укажите email и пароль");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (!isTauri()) {
      setError("Для регистрации пользователя в PostgreSQL запустите через Tauri ('npm run tauri dev')");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<AuthResponse>("register", {
        email: email.trim(),
        password,
      });

      if (res.success) {
        setSuccess("Аккаунт успешно создан! Теперь вы можете войти.");
        setMode("login");
      } else {
        setError(res.message || "Ошибка при создании аккаунта.");
      }
    } catch (err: any) {
      setError(`Ошибка: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!resetEmail.trim()) {
      setError("Пожалуйста, введите адрес электронной почты");
      return;
    }

    if (!isTauri()) {
      setError("Для работы сброса пароля запустите десктоп-приложение ('npm run tauri dev')");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<ResetRequestResponse>("request_reset_code", {
        email: resetEmail.trim(),
      });

      if (res.success) {
        setResetStage(2);
        setSuccess(res.message);
      } else {
        setError(res.message || "Ошибка отправки проверочного кода");
      }
    } catch (err: any) {
      setError(`Ошибка: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!resetCode.trim()) {
      setError("Пожалуйста, введите проверочный код");
      return;
    }

    if (!isTauri()) {
      setError("Для проверки кода запустите десктоп-приложение");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<AuthResponse>("verify_reset_code", {
        email: resetEmail.trim(),
        code: resetCode.trim(),
      });

      if (res.success) {
        setResetStage(3);
        setSuccess("Код подтвержден! Теперь задайте новый пароль.");
      } else {
        setError(res.message || "Неверный код подтверждения");
      }
    } catch (err: any) {
      setError(`Ошибка: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword) {
      setError("Пожалуйста, введите новый пароль");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (!isTauri()) {
      setError("Для смены пароля запустите десктоп-приложение");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<AuthResponse>("reset_password", {
        email: resetEmail.trim(),
        code: resetCode.trim(),
        newPassword,
      });

      if (res.success) {
        setMode("login");
        setEmail(resetEmail.trim());
        setPassword("");
        setResetEmail("");
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setResetStage(1);
        setSuccess("Пароль успешно обновлен! Войдите с новым паролем.");
      } else {
        setError(res.message || "Не удалось изменить пароль");
      }
    } catch (err: any) {
      setError(`Ошибка: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("has_remembered_user");
    setPassword("");
    setConfirmPassword("");
    setSuccess(null);
    setError(null);
  };

  // currentUser handled inside return below

  return (
    <div className="app-viewport">
      {/* Top Header / DB Connection Pill */}
      <header className="top-bar">
        <button
          type="button"
          className={`db-pill ${dbStatus?.connected ? "connected" : "error"}`}
          onClick={() => setShowDbModal(true)}
          title="Нажмите для просмотра параметров .env и статуса БД"
        >
          <span className="db-dot"></span>
          <DatabaseIcon className="w-4 h-4" />
          <span>
            {dbStatus?.connected
              ? `PostgreSQL: ${dbStatus.host}`
              : "PostgreSQL: Проверить подключение"}
          </span>
        </button>
      </header>

      {/* Main Content Area */}
      {currentUser ? (
        /* Authenticated Dashboard — simple welcome card */
        <main className="dashboard-container">
          <div className="dashboard-card">
            <div className="dashboard-avatar">
              <span style={{ fontSize: 28, fontWeight: 700 }}>
                {currentUser.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <h2 className="dashboard-title">Добро пожаловать!</h2>
            <p className="dashboard-subtitle">{currentUser.email}</p>

            <div className="info-grid">
              <div className="info-item">
                <div className="info-item-label">Статус сессии</div>
                <div className="info-item-value" style={{ color: "#10b981" }}>
                  ● Авторизован
                </div>
              </div>
              <div className="info-item">
                <div className="info-item-label">Сервер PostgreSQL</div>
                <div className="info-item-value">{dbInfo?.host || dbStatus?.host || "Удаленный хост"}</div>
              </div>
              <div className="info-item">
                <div className="info-item-label">База данных</div>
                <div className="info-item-value">{dbInfo?.dbname || "postgres"}</div>
              </div>
              <div className="info-item">
                <div className="info-item-label">Таблица пользователей</div>
                <div className="info-item-value">{dbInfo?.users_table || "users"}</div>
              </div>
            </div>

            <button type="button" className="btn-primary" onClick={handleLogout}>
              Выйти из аккаунта
            </button>
          </div>
        </main>
      ) : mode === "reset" ? (
        /* Password Reset Flow */
        <main className="auth-main-container">
          <div className="auth-card">
            {/* Project Branding */}
            <div className="brand-header">
              <img src={logoUrl} alt="Home Autli Server" className="brand-logo-img" />
              <span className="brand-title">Home Autli Server</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="auth-heading">
              {resetStage === 1
                ? "Сброс пароля"
                : resetStage === 2
                ? "Сброс пароля"
                : "Новый пароль"}
            </h1>
            <p className="auth-subheading">
              {resetStage === 1
                ? "Забыли пароль? Введите email для получения проверочного кода."
                : resetStage === 2
                ? "Введите 6-значный код подтверждения из письма."
                : "Код подтвержден. Введите новый пароль для вашей учетной записи:"}
            </p>

            {/* Notification Messages */}
            {error && (
              <div className="alert-box alert-error">
                <AlertCircleIcon className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert-box alert-success">
                <CheckCircleIcon className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}

            {/* Step 1: Request code by email */}
            {resetStage === 1 && (
              <form className="auth-form" onSubmit={handleRequestResetCode}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">
                    Электронная почта
                  </label>
                  <div className="input-container">
                    <div className="input-icon-left">
                      <MailIcon />
                    </div>
                    <input
                      id="reset-email"
                      type="email"
                      className="form-input"
                      placeholder="user@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <SpinnerIcon className="w-5 h-5" />
                      <span>Отправка кода...</span>
                    </>
                  ) : (
                    <>
                      <span>Получить код</span>
                      <LockIcon className="w-5 h-5" />
                    </>
                  )}
                </button>

                <div style={{ textAlign: "center" }}>
                  <span
                    className="back-link"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    <ChevronLeftIcon /> Назад ко входу
                  </span>
                </div>
              </form>
            )}

            {/* Step 2: Verify code (6 separate OTP boxes matching mockup) */}
            {resetStage === 2 && (
              <form className="auth-form" onSubmit={handleVerifyResetCode}>
                <OtpInput
                  value={resetCode}
                  onChange={(code) => setResetCode(code)}
                  disabled={loading}
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || resetCode.length < 6}
                >
                  {loading ? (
                    <>
                      <SpinnerIcon className="w-5 h-5" />
                      <span>Проверка...</span>
                    </>
                  ) : (
                    <>
                      <span>Подтвердить код</span>
                      <LockIcon className="w-5 h-5" />
                    </>
                  )}
                </button>

                <div className="resend-countdown-text">
                  Не получили код?{" "}
                  {countdown > 0 ? (
                    <span className="resend-countdown-timer">
                      Отправить повторно через {countdown}с
                    </span>
                  ) : (
                    <span
                      className="resend-countdown-link"
                      onClick={(e) => {
                        handleRequestResetCode(e);
                        setCountdown(30);
                      }}
                    >
                      Отправить код повторно
                    </span>
                  )}
                </div>

                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <span
                    className="back-link"
                    style={{ marginTop: 0 }}
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    <ChevronLeftIcon /> Назад ко входу
                  </span>
                </div>
              </form>
            )}

            {/* Step 3: Enter new password and confirmation */}
            {resetStage === 3 && (
              <form className="auth-form" onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">
                    Новый пароль
                  </label>
                  <div className="input-container">
                    <div className="input-icon-left">
                      <LockIcon />
                    </div>
                    <input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      className="form-input has-right-icon"
                      placeholder="••••••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="input-icon-right"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-new-password">
                    Повтор нового пароля
                  </label>
                  <div className="input-container">
                    <div className="input-icon-left">
                      <LockIcon />
                    </div>
                    <input
                      id="confirm-new-password"
                      type={showNewPassword ? "text" : "password"}
                      className="form-input has-right-icon"
                      placeholder="••••••••••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="input-icon-right"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <SpinnerIcon className="w-5 h-5" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <span>Сохранить новый пароль</span>
                      <ArrowRightLoginIcon className="w-5 h-5" />
                    </>
                  )}
                </button>

                <div style={{ textAlign: "center" }}>
                  <span
                    className="back-link"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    <ChevronLeftIcon /> Назад ко входу
                  </span>
                </div>
              </form>
            )}
          </div>
        </main>
      ) : (
        /* Login / Register Card with actual logo & branding */
        <main className="auth-main-container">
          <div className="auth-card">
            {/* Actual Project Logo and Name */}
            <div className="brand-header">
              <img src={logoUrl} alt="Home Autli Server" className="brand-logo-img" />
              <span className="brand-title">Home Autli Server</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="auth-heading">
              {mode === "login" ? "Вход в аккаунт" : "Создать аккаунт"}
            </h1>
            <p className="auth-subheading">
              {mode === "login"
                ? "Авторизация в системе Home Autli Server"
                : "Регистрация нового пользователя на сервере"}
            </p>

            {/* Notification Messages */}
            {error && (
              <div className="alert-box alert-error">
                <AlertCircleIcon className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert-box alert-success">
                <CheckCircleIcon className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}

            {/* Form */}
            <form
              className="auth-form"
              onSubmit={mode === "login" ? handleLogin : handleRegister}
            >
              {/* Email Address */}
              <div className="form-group">
                <label className="form-label" htmlFor="email-input">
                  Электронная почта
                </label>
                <div className="input-container">
                  <div className="input-icon-left">
                    <MailIcon />
                  </div>
                  <input
                    id="email-input"
                    type="email"
                    className="form-input"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="password-input">
                  Пароль
                </label>
                <div className="input-container">
                  <div className="input-icon-left">
                    <LockIcon />
                  </div>
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    className="form-input has-right-icon"
                    placeholder="••••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="input-icon-right"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Register mode) */}
              {mode === "register" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-password-input">
                    Подтверждение пароля
                  </label>
                  <div className="input-container">
                    <div className="input-icon-left">
                      <LockIcon />
                    </div>
                    <input
                      id="confirm-password-input"
                      type={showPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="••••••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password (Login mode) */}
              {mode === "login" && (
                <div className="form-options-row">
                  <label className="remember-label">
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Запомнить на 30 дней</span>
                  </label>

                  <span
                    className="forgot-link"
                    onClick={() => {
                      setMode("reset");
                      setResetStage(1);
                      setResetEmail(email.trim());
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    Забыли пароль?
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="w-5 h-5" />
                    <span>Подождите...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === "login" ? "Войти" : "Зарегистрироваться"}</span>
                    <ArrowRightLoginIcon className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Switch Mode Link */}
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <span className="signup-hint">
                  {mode === "login" ? (
                    <>
                      Нет аккаунта?{" "}
                      <span
                        className="signup-link"
                        onClick={() => {
                          setMode("register");
                          setError(null);
                          setSuccess(null);
                        }}
                      >
                        Зарегистрироваться
                      </span>
                    </>
                  ) : (
                    <>
                      Уже есть аккаунт?{" "}
                      <span
                        className="signup-link"
                        onClick={() => {
                          setMode("login");
                          setError(null);
                          setSuccess(null);
                        }}
                      >
                        Войти
                      </span>
                    </>
                  )}
                </span>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div>Copyright © 2026 Home Autli Server</div>
        <div className="footer-links">
          <span>Политика конфиденциальности</span>
          <span>Условия использования</span>
        </div>
      </footer>

      {/* Database Diagnostics Modal */}
      {showDbModal && (
        <div className="modal-overlay" onClick={() => setShowDbModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Конфигурация PostgreSQL (.env)</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDbModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                Все данные для подключения к вашей базе данных считываются строго из файла{" "}
                <strong>.env</strong> в корне приложения:
              </p>

              <div className="code-block">
                DB_HOST={dbInfo?.host || "127.0.0.1"}
                <br />
                DB_PORT={dbInfo?.port || 5432}
                <br />
                DB_USER={dbInfo?.user || "postgres"}
                <br />
                DB_PASSWORD=••••••••
                <br />
                DB_NAME={dbInfo?.dbname || "postgres"}
                <br />
                DB_USERS_TABLE={dbInfo?.users_table || "users"}
                <br />
                DB_EMAIL_COLUMN={dbInfo?.email_column || "email"}
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: dbStatus?.connected ? "#ecfdf5" : "#fef2f2",
                  color: dbStatus?.connected ? "#065f46" : "#991b1b",
                  fontSize: 13,
                }}
              >
                <strong>Статус:</strong> {dbStatus?.message || "Проверка..."}
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ height: 40, fontSize: 13 }}
                  onClick={() => checkDatabase()}
                >
                  Проверить соединение заново
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ height: 40, fontSize: 13, backgroundColor: "#f3f4f6", color: "#374151", boxShadow: "none" }}
                  onClick={() => setShowDbModal(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Восстановление доступа</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowForgotModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Поскольку авторизация работает напрямую с вашей удаленной базой данных
                PostgreSQL, для смены или сброса пароля выполните обновление хэша или значения
                пароля в таблице <strong>{dbInfo?.users_table || "users"}</strong> на вашем сервере,
                либо воспользуйтесь функцией создания нового аккаунта.
              </p>
              <div style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ height: 40, fontSize: 13 }}
                  onClick={() => setShowForgotModal(false)}
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
