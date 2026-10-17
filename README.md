# Home Autli Server (HAS) 🚀

> **Личный облачный сервер, Кинотеатр Full HD с полной русской озвучкой (дубляж) и защищенное хранилище данных.**

[![Release Build & Auto-Updater](https://github.com/autli5/has/actions/workflows/release.yml/badge.svg)](https://github.com/autli5/has/actions/workflows/release.yml)
[![Version](https://img.shields.io/badge/version-v0.1.5-blue.svg)](https://github.com/autli5/has/releases/latest)
[![Platforms](https://img.shields.io/badge/platforms-Linux%20%7C%20Windows%20%7C%20macOS-success.svg)](https://github.com/autli5/has/releases/latest)

---

## ⚡ Быстрая установка на Linux через Терминал

Поддерживаются любые дистрибутивы: **Ubuntu, Debian, Fedora, Arch Linux, CachyOS, Manjaro, Linux Mint, Pop!_OS** и другие.

Выполните одну команду в терминале:

```bash
curl -fsSL https://raw.githubusercontent.com/autli5/has/main/install.sh | bash
```

*или через `wget`:*

```bash
wget -qO- https://raw.githubusercontent.com/autli5/has/main/install.sh | bash
```

Установщик сам определит ваш дистрибутив (Debian, Ubuntu, Fedora, Arch, CachyOS), скачает подходящий пакет (`.deb`, `.rpm` или `.AppImage`), установит необходимые зависимости и создаст ярлык в меню приложений.

Запуск из терминала:
```bash
has
```

---

## 📦 Ручная установка по дистрибутивам

### 🐧 Ubuntu / Debian / Linux Mint / Pop!_OS (`.deb`)

```bash
# 1. Скачивание последнего пакета .deb
curl -s https://api.github.com/repos/autli5/has/releases/latest | grep "browser_download_url.*amd64.deb" | cut -d : -f 2,3 | tr -d \" | wget -qi -

# 2. Установка через dpkg
sudo dpkg -i home-autli-server_*_amd64.deb || sudo apt-get install -f -y
```

### 🎩 Fedora / RHEL / CentOS (`.rpm`)

```bash
# 1. Скачивание пакета .rpm
curl -s https://api.github.com/repos/autli5/has/releases/latest | grep "browser_download_url.*x86_64.rpm" | cut -d : -f 2,3 | tr -d \" | wget -qi -

# 2. Установка через dnf
sudo dnf install -y ./home-autli-server-*.rpm
```

### 🏹 Arch Linux / CachyOS / Manjaro / EndeavourOS

#### Вариант A: Через `install.sh` (Рекомендуется)
```bash
curl -fsSL https://raw.githubusercontent.com/autli5/has/main/install.sh | bash -s -- --arch
```

#### Вариант B: Через `PKGBUILD`
```bash
git clone https://github.com/autli5/has.git
cd has
makepkg -si
```

---

## 💻 Другие операционные системы

- **🍏 macOS (Apple Silicon & Intel):** Скачайте `.dmg` из [последнего релиза](https://github.com/autli5/has/releases/latest).
- **🪟 Windows 10/11 (64-bit):** Скачайте `.exe` установщик из [последнего релиза](https://github.com/autli5/has/releases/latest).

---

## ✨ Основные возможности приложения

- 🎬 **Кинотеатр нового поколения:**
  - Огромный каталог фильмов, сериалов и аниме без региональных блокировок.
  - **100% Русская озвучка / Дубляж по умолчанию:** Smotrim, Embess, Alloha (Red Head Sound, Flarrow Films, СНГ-дубляж).
  - Студийные озвучки для аниме: **Studio Band, AniLibria, AniDUB, SHIZA Project**.
  - Полноэкранный режим с поддержкой звука и выбором серий прямо в плеере.
- 📁 **Облачное хранилище файлов:** Загрузка, папки, превью и мгновенная синхронизация.
- 👤 **Профиль пользователя:** Настройка темы, персонализация и управление аккаунтом.
- 🔄 **Авто-обновления:** Встроенный механизм проверки и загрузки новых версий (Tauri Updater).
