import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import logoUrl from "./assets/logo.png";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightLoginIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SpinnerIcon,
  ChevronLeftIcon,
  UserIcon,
} from "./components/Icons";
import { AuthResponse, DbStatus, ResetRequestResponse, SafeDbInfo, UserDto } from "./types";
import { OtpInput } from "./components/OtpInput";
import { UpdaterBanner } from "./components/UpdaterBanner";
import "./App.css";
import Dashboard from "./pages/dashboard/Dashboard";

const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export default function App() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration verification code state
  const [regStage, setRegStage] = useState<1 | 2>(1);
  const [regCode, setRegCode] = useState("");
  const [regCooldown, setRegCooldown] = useState(0);

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

  const [showForgotModal, setShowForgotModal] = useState(false);

  useEffect(() => {
    if (regCooldown > 0) {
      const timer = setTimeout(() => setRegCooldown(regCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [regCooldown]);

  // Check saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("has_remembered_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed?.email && parsed.email.toLowerCase() === "ne60201@gmail.com") {
          parsed.role = "admin";
        }
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

  const isValidEmailFormat = (val: string) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
  };

  const handleRequestRegCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Пожалуйста, укажите email и пароль");
      return;
    }

    if (!isValidEmailFormat(cleanEmail)) {
      setError("Пожалуйста, введите корректный адрес электронной почты (например, name@mail.ru)");
      return;
    }

    if (!username.trim()) {
      setError("Пожалуйста, укажите имя пользователя");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }

    if (!isTauri()) {
      setError("Для регистрации пользователя запустите приложение в десктопном режиме");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<ResetRequestResponse>("request_registration_code", {
        email: cleanEmail,
        username: username.trim(),
      });

      if (res.success) {
        setRegStage(2);
        setRegCooldown(60);
        setSuccess(res.message);
        if (res.dev_code) {
          setRegCode(res.dev_code);
        }
      } else {
        setError(res.message || "Ошибка отправки кода подтверждения на указанную почту.");
      }
    } catch (err: any) {
      setError(`Ошибка: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!regCode.trim()) {
      setError("Пожалуйста, введите проверочный код из письма");
      return;
    }

    if (!isTauri()) {
      setError("Для регистрации пользователя запустите десктопное приложение");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<AuthResponse>("register_with_code", {
        email: email.trim(),
        code: regCode.trim(),
        password,
        username: username.trim(),
      });

      if (res.success) {
        setSuccess("Аккаунт успешно создан и подтвержден! Теперь вы можете войти.");
        setRegStage(1);
        setRegCode("");
        setMode("login");
      } else {
        setError(res.message || "Ошибка подтверждения кода или создания аккаунта.");
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

  if (currentUser) {
    return (
      <>
        <UpdaterBanner />
        <Dashboard
          user={currentUser}
          dbInfo={dbInfo}
          dbStatus={dbStatus}
          onLogout={handleLogout}
        />
      </>
    );
  }

  return (
    <div className="app-viewport">
      {/* Auto-updater banner */}
      <UpdaterBanner />

      {/* Main Content Area */}
      {mode === "reset" ? (
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
            {mode === "register" && regStage === 2 ? (
              <form className="auth-form" onSubmit={handleCompleteRegistration}>
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)", lineHeight: 1.5 }}>
                    На почту <strong style={{ color: "var(--text-primary, #fff)" }}>{email.trim()}</strong> отправлен 6-значный проверочный код.
                    Введите его для подтверждения адреса:
                  </div>
                </div>

                <OtpInput
                  value={regCode}
                  onChange={(code) => setRegCode(code)}
                  disabled={loading}
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || regCode.length < 6}
                >
                  {loading ? (
                    <>
                      <SpinnerIcon className="w-5 h-5" />
                      <span>Создание аккаунта...</span>
                    </>
                  ) : (
                    <>
                      <span>Завершить регистрацию</span>
                      <CheckCircleIcon className="w-5 h-5" />
                    </>
                  )}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    className="forgot-link"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    onClick={() => {
                      setRegStage(1);
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    ← Изменить данные
                  </button>

                  <button
                    type="button"
                    className="forgot-link"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: regCooldown > 0 ? "not-allowed" : "pointer",
                      padding: 0,
                      opacity: regCooldown > 0 ? 0.6 : 1,
                    }}
                    disabled={regCooldown > 0 || loading}
                    onClick={() => handleRequestRegCode()}
                  >
                    {regCooldown > 0 ? `Повтор через ${regCooldown} с` : "Отправить код еще раз"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="auth-form"
                onSubmit={mode === "login" ? handleLogin : handleRequestRegCode}
              >
                {/* Username (Register mode only) */}
                {mode === "register" && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="username-input">
                      Имя пользователя
                    </label>
                    <div className="input-container">
                      <div className="input-icon-left">
                        <UserIcon />
                      </div>
                      <input
                        id="username-input"
                        type="text"
                        className="form-input"
                        placeholder="Например: Иван Иванов"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

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
                      <span>{mode === "login" ? "Войти" : "Получить проверочный код"}</span>
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
                            setRegStage(1);
                            setRegCode("");
                            setUsername("");
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
                            setRegStage(1);
                            setRegCode("");
                            setUsername("");
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
            )}
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div>Copyright © 2026 Home Autli Server</div>
        {/*<div className="footer-links">
          <span>Политика конфиденциальности</span>
          <span>Условия использования</span>
        </div>*/}
      </footer>

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
                Для смены или сброса пароля обратитесь к системному администратору
                сервера либо воспользуйтесь функцией создания новой учетной записи.
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
