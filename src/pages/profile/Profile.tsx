import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserDto, UserProfileDto, UserProfileSaveDto } from "../../types";
import "./Profile.css";

interface ProfileProps {
  currentUser: UserDto;
  onUpdateUser?: (updated: UserDto) => void;
}

export default function Profile({ currentUser, onUpdateUser }: ProfileProps) {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const [searchFilter, setSearchFilter] = useState("");

  // Form State
  const [profileData, setProfileData] = useState<UserProfileDto | null>(null);
  const [username, setUsername] = useState(currentUser.username || "");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySound, setNotifySound] = useState(true);
  const [notifySecurity, setNotifySecurity] = useState(true);

  // Status & Feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Profile from DB
  const loadProfile = async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await invoke<UserProfileDto>("get_user_profile", {
        userEmail: currentUser.email,
      });
      setProfileData(data);
      setUsername(data.username || currentUser.username || "");
      setAvatar(data.avatar || null);
      setBio(data.bio || "");
      setNotifyEmail(data.notify_email);
      setNotifySound(data.notify_sound);
      setNotifySecurity(data.notify_security);
    } catch (err) {
      console.error("Ошибка загрузки профиля:", err);
      setErrorMsg(`Не удалось загрузить данные из базы: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [currentUser.email]);

  // Handle Avatar Upload with Canvas Resizing & Optimization
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      if (!rawData) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type === "image/png";
          const optimizedDataUrl = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.88);
          setAvatar(optimizedDataUrl);
        } else {
          setAvatar(rawData);
        }
      };
      img.onerror = () => {
        setAvatar(rawData);
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  // Delete Avatar
  const handleDeleteAvatar = () => {
    setAvatar(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Save Profile to PostgreSQL DB
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isTauri) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: UserProfileSaveDto = {
        username: username.trim() || null,
        avatar: avatar || null,
        bio: bio.trim() || null,
        notify_email: notifyEmail,
        notify_sound: notifySound,
        notify_security: notifySecurity,
      };

      const updated = await invoke<UserProfileDto>("save_user_profile", {
        userEmail: currentUser.email,
        profile: payload,
      });

      setProfileData(updated);
      setSaveSuccessMsg("✓ Профиль успешно сохранен в базе данных!");
      setTimeout(() => setSaveSuccessMsg(null), 3500);

      if (onUpdateUser) {
        onUpdateUser({
          ...currentUser,
          username: updated.username || undefined,
          avatar: updated.avatar || null,
          bio: updated.bio || null,
        });
      }
    } catch (err) {
      console.error("Ошибка сохранения профиля:", err);
      setErrorMsg(`Ошибка сохранения: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset form to loaded values
  const handleCancel = () => {
    if (profileData) {
      setUsername(profileData.username || currentUser.username || "");
      setAvatar(profileData.avatar || null);
      setBio(profileData.bio || "");
      setNotifyEmail(profileData.notify_email);
      setNotifySound(profileData.notify_sound);
      setNotifySecurity(profileData.notify_security);
    }
    setErrorMsg(null);
  };

  const remainingBioChars = Math.max(0, 30 - bio.length);

  return (
    <div className="has-profile-wrapper">
      {/* ========================================================
          1. TOP SETTINGS HEADER WITH SEARCH
          ======================================================== */}
      <div className="has-profile-top-header">
        <h1 className="has-profile-main-title">Профиль и настройки</h1>
        <div className="has-profile-search-box">
          <svg className="has-profile-search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth={2} />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Поиск настроек..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="has-profile-search-input"
          />
        </div>
      </div>

      {/* Sub-navigation: ONLY General */}
      <div className="has-profile-subtabs-row">
        <button
          type="button"
          className="has-profile-subtab active"
        >
          Основные
        </button>
      </div>

      {/* Hidden File Input for Avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ========================================================
          2. MAIN CARD: YOUR PROFILE
          ======================================================== */}
      <div className="has-profile-card">
        {/* Card Header Row */}
        <div className="has-profile-card-header">
          <div>
            <h2 className="has-profile-card-title">Ваш профиль</h2>
            <p className="has-profile-card-subtitle">Управление параметрами и настройками профиля</p>
          </div>

          <div className="has-profile-header-actions">
            {/* Tooltip trigger icon */}
            <div
              className="has-profile-info-trigger"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
                <line x1="12" y1="16" x2="12" y2="12" strokeWidth={1.8} strokeLinecap="round" />
                <circle cx="12" cy="8" r="1" fill="currentColor" />
              </svg>

              {/* Tooltip Popover */}
              {showTooltip && (
                <div className="has-profile-tooltip-box">
                  <div className="has-profile-tooltip-title">Home Autli Server Profile</div>
                  <div className="has-profile-tooltip-text">
                    Данные профиля безопасно сохраняются в PostgreSQL базе вашего домашнего сервера.
                  </div>
                  <div className="has-profile-tooltip-arrow" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMsg && <div className="has-profile-alert-error">{errorMsg}</div>}
        {successMsg && <div className="has-profile-alert-success">{successMsg}</div>}

        {loading ? (
          <div className="has-profile-loading-state">
            <span>Загрузка данных профиля из PostgreSQL...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="has-profile-form">
            {/* ROW 1: USERNAME (Mockup: has.server/ [Input] (?)) */}
            <div className="has-profile-row">
              <label className="has-profile-label">Имя пользователя (Никнейм)</label>
              <div className="has-profile-input-compound">
                <span className="has-profile-prefix">has.server/</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="has-profile-input-text"
                />
                <span className="has-profile-input-addon-icon" title="Ваш системный никнейм на сервере">
                  ?
                </span>
              </div>
            </div>

            {/* ROW 2: EMAIL ADDRESS (Primary Account Identifier) */}
            <div className="has-profile-row">
              <label className="has-profile-label">Электронная почта</label>
              <div className="has-profile-email-readonly-box">
                <span className="has-profile-email-val">{currentUser.email}</span>
                <span className="has-profile-email-verified-badge">✓ Основной аккаунт</span>
              </div>
            </div>

            {/* ROW 3: PROFILE PICTURE (Circle Avatar + Edit + Delete buttons) */}
            <div className="has-profile-row has-profile-row-avatar">
              <label className="has-profile-label">Фотография профиля</label>
              <div className="has-profile-avatar-group">
                <div
                  className="has-profile-avatar-circle"
                  onClick={() => fileInputRef.current?.click()}
                  title="Нажмите для загрузки аватара"
                  style={{ cursor: "pointer" }}
                >
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="has-profile-avatar-img" />
                  ) : (
                    <div className="has-profile-avatar-fallback">
                      {(username || currentUser.email || "U").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="has-profile-avatar-actions">
                  <button
                    type="button"
                    className="has-profile-btn-avatar-edit"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Изменить
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      className="has-profile-btn-avatar-delete"
                      onClick={handleDeleteAvatar}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 4: STATUS / BIO (Compact up to 30 characters) */}
            <div className="has-profile-row has-profile-row-bio">
              <div className="has-profile-label-with-icon">
                <label className="has-profile-label">Статус / О себе</label>
                <span
                  className="has-profile-help-circle"
                  title="Краткий статус отображается под вашим никнеймом в меню слева (до 30 символов)"
                >
                  ?
                </span>
              </div>
              <div className="has-profile-bio-container">
                <input
                  type="text"
                  maxLength={30}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Например: Смотрю фильм, На связи..."
                  className="has-profile-input has-profile-bio-input"
                />
                <div className="has-profile-bio-footer">
                  <span className="has-profile-chars-count">
                    Осталось символов: {remainingBioChars} / 30
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 5: NOTIFICATIONS (Checkboxes with descriptions) */}
            <div className="has-profile-row has-profile-row-notifications">
              <label className="has-profile-label">Уведомления</label>
              <div className="has-profile-notifs-list">
                {/* 1. Email Notification */}
                <label className="has-profile-checkbox-card">
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="has-profile-native-checkbox"
                  />
                  <span className="has-profile-custom-checkbox" />
                  <div className="has-profile-checkbox-text">
                    <span className="has-profile-checkbox-title">Уведомления по Email</span>
                    <span className="has-profile-checkbox-desc">
                      Получать письма при возникновении важных системных событий сервера.
                    </span>
                  </div>
                </label>

                {/* 2. Sound Notification */}
                <label className="has-profile-checkbox-card">
                  <input
                    type="checkbox"
                    checked={notifySound}
                    onChange={(e) => setNotifySound(e.target.checked)}
                    className="has-profile-native-checkbox"
                  />
                  <span className="has-profile-custom-checkbox" />
                  <div className="has-profile-checkbox-text">
                    <span className="has-profile-checkbox-title">Звуковые оповещения</span>
                    <span className="has-profile-checkbox-desc">
                      Воспроизводить звук при завершении фоновых операций.
                    </span>
                  </div>
                </label>

                {/* 3. Security Notification */}
                <label className="has-profile-checkbox-card">
                  <input
                    type="checkbox"
                    checked={notifySecurity}
                    onChange={(e) => setNotifySecurity(e.target.checked)}
                    className="has-profile-native-checkbox"
                  />
                  <span className="has-profile-custom-checkbox" />
                  <div className="has-profile-checkbox-text">
                    <span className="has-profile-checkbox-title">Оповещения безопасности</span>
                    <span className="has-profile-checkbox-desc">
                      Уведомлять при входе в систему с новых устройств или сетей.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* BOTTOM ACTION BAR: Cancel + Save */}
            <div className="has-profile-card-footer">
              <button
                type="button"
                className="has-profile-btn-cancel"
                onClick={handleCancel}
                disabled={saving}
              >
                <span>Отмена</span>
                <span className="has-profile-action-icon">✕</span>
              </button>

              <button
                type="submit"
                className="has-profile-btn-save"
                disabled={saving}
              >
                <span>{saving ? "Сохранение..." : "Сохранить"}</span>
                <span className="has-profile-action-icon">✓</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
