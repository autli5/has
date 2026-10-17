#!/usr/bin/env bash
# ==============================================================================
# Home Autli Server (HAS) - Универсальный установщик для Linux через терминал
# Поддерживает: Ubuntu, Debian, Fedora, Arch Linux, CachyOS, Manjaro и др.
#
# Быстрый запуск одной командой в терминале:
#   curl -fsSL https://raw.githubusercontent.com/autli5/has/main/install.sh | bash
# или
#   wget -qO- https://raw.githubusercontent.com/autli5/has/main/install.sh | bash
# ==============================================================================

set -e

REPO="autli5/has"
APP_NAME="Home Autli Server"
BIN_NAME="has"

# Цвета для вывода в терминале
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "    🚀 Установка Home Autli Server (HAS) для Linux       "
echo "    Кинотеатр (Full HD + Русская озвучка) и Облако        "
echo "    Поддержка: Ubuntu, Debian, Fedora, Arch, CachyOS      "
echo "=========================================================="
echo -e "${RESET}"

# 1. Проверка архитектуры системы
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "aarch64" ]; then
    echo -e "${RED}Ошибка: архитектура $ARCH не поддерживается.${RESET}"
    exit 1
fi

# 2. Определение дистрибутива Linux
PKG_TYPE=""
for arg in "$@"; do
    case "$arg" in
        --deb) PKG_TYPE="deb" ;;
        --rpm) PKG_TYPE="rpm" ;;
        --arch|--cachyos) PKG_TYPE="arch" ;;
        --appimage) PKG_TYPE="appimage" ;;
    esac
done

if [ -z "$PKG_TYPE" ]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO_ID="${ID:-linux}"
        DISTRO_LIKE="${ID_LIKE:-}"
        
        case "$DISTRO_ID $DISTRO_LIKE" in
            *ubuntu*|*debian*|*linuxmint*|*pop*|*elementary*|*zorin*|*kali*)
                PKG_TYPE="deb"
                echo -e "${BLUE}ℹ️ Обнаружен дистрибутив Debian / Ubuntu (${DISTRO_ID}). Формат: .deb${RESET}"
                ;;
            *fedora*|*rhel*|*centos*|*rocky*|*almalinux*)
                PKG_TYPE="rpm"
                echo -e "${BLUE}ℹ️ Обнаружен дистрибутив Fedora / Red Hat (${DISTRO_ID}). Формат: .rpm${RESET}"
                ;;
            *arch*|*cachyos*|*cachy*|*manjaro*|*endeavouros*|*artix*)
                PKG_TYPE="arch"
                echo -e "${BLUE}ℹ️ Обнаружен дистрибутив Arch Linux / CachyOS (${DISTRO_ID}).${RESET}"
                ;;
            *)
                PKG_TYPE="appimage"
                echo -e "${BLUE}ℹ️ Обнаружен дистрибутив Linux (${DISTRO_ID}). Формат: .AppImage${RESET}"
                ;;
        esac
    else
        PKG_TYPE="appimage"
        echo -e "${YELLOW}⚠️ Не удалось определить дистрибутив. Будет использован универсальный AppImage.${RESET}"
    fi
fi

# 3. Получение последней версии из GitHub Releases
echo -e "${CYAN}🔍 Поиск последней версии в GitHub (${REPO})...${RESET}"

RELEASE_JSON=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" || true)
TAG_NAME=$(echo "$RELEASE_JSON" | grep -m1 '"tag_name":' | cut -d '"' -f 4 || true)

if [ -z "$TAG_NAME" ]; then
    TAG_NAME="v0.1.5"
    echo -e "${YELLOW}⚠️ Использована версия по умолчанию: ${TAG_NAME}${RESET}"
else
    echo -e "${GREEN}✓ Найдена версия: ${TAG_NAME}${RESET}"
fi

# 4. Поиск прямой ссылки на скачивание нужного пакета
DOWNLOAD_URL=""
case "$PKG_TYPE" in
    deb)
        DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.deb' | head -n 1 || true)
        ;;
    rpm)
        DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.rpm' | head -n 1 || true)
        ;;
    arch|appimage)
        DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.AppImage' | head -n 1 || true)
        ;;
esac

# Запасные прямые URL если GitHub API не вернул ссылки в JSON
if [ -z "$DOWNLOAD_URL" ]; then
    case "$PKG_TYPE" in
        deb)
            DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG_NAME}/home-autli-server_${TAG_NAME#v}_amd64.deb"
            ;;
        rpm)
            DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG_NAME}/home-autli-server-${TAG_NAME#v}-1.x86_64.rpm"
            ;;
        arch|appimage)
            DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG_NAME}/home-autli-server_${TAG_NAME#v}_amd64.AppImage"
            ;;
    esac
fi

TMP_DIR=$(mktemp -d /tmp/has-install.XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

FILE_NAME=$(basename "$DOWNLOAD_URL")
TMP_FILE="$TMP_DIR/$FILE_NAME"

echo -e "${CYAN}⬇️ Скачивание пакета (${FILE_NAME})...${RESET}"
if command -v curl &>/dev/null; then
    curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TMP_FILE"
elif command -v wget &>/dev/null; then
    wget -q --show-progress "$DOWNLOAD_URL" -O "$TMP_FILE"
else
    echo -e "${RED}Ошибка: необходимо установить curl или wget.${RESET}"
    exit 1
fi

echo -e "${GREEN}✓ Файл успешно загружен.${RESET}"

# 5. Установка пакета в систему
echo -e "${CYAN}⚙️ Установка ${APP_NAME}...${RESET}"

case "$PKG_TYPE" in
    deb)
        echo -e "${BLUE}Выполняется установка .deb через dpkg / apt...${RESET}"
        if sudo dpkg -i "$TMP_FILE"; then
            echo -e "${GREEN}✓ Пакет установлен.${RESET}"
        else
            echo -e "${YELLOW}Доустановка недостающих зависимостей...${RESET}"
            sudo apt-get update -qq
            sudo apt-get install -f -y
        fi
        ;;
    rpm)
        echo -e "${BLUE}Выполняется установка .rpm через dnf / rpm...${RESET}"
        if command -v dnf &>/dev/null; then
            sudo dnf install -y "$TMP_FILE"
        elif command -v yum &>/dev/null; then
            sudo yum localinstall -y "$TMP_FILE"
        else
            sudo rpm -Uvh --replacepkgs "$TMP_FILE"
        fi
        ;;
    arch)
        echo -e "${BLUE}Настройка для Arch Linux / CachyOS...${RESET}"
        # Проверка и установка зависимостей через pacman при необходимости
        if command -v pacman &>/dev/null; then
            echo -e "${CYAN}Проверка зависимостей (webkit2gtk-4.1, libappindicator-gtk3)...${RESET}"
            sudo pacman -S --needed --noconfirm webkit2gtk-4.1 libappindicator-gtk3 librsvg || true
        fi
        
        chmod +x "$TMP_FILE"
        INSTALL_BIN="$HOME/.local/bin"
        mkdir -p "$INSTALL_BIN"
        mv "$TMP_FILE" "$INSTALL_BIN/$BIN_NAME"
        
        # Скачивание логотипа HAS для меню CachyOS / Arch
        ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
        mkdir -p "$ICON_DIR"
        curl -sL "https://raw.githubusercontent.com/${REPO}/main/public/logo.png" -o "$ICON_DIR/has.png" 2>/dev/null || true
        
        # Создание .desktop файла для меню приложений (KDE Plasma, GNOME, Hyprland, XFCE)
        DESKTOP_DIR="$HOME/.local/share/applications"
        mkdir -p "$DESKTOP_DIR"
        cat <<EOF > "$DESKTOP_DIR/home-autli-server.desktop"
[Desktop Entry]
Name=Home Autli Server
Comment=Личный сервер, Кинотеатр (Full HD + Русская озвучка) и Облако
Exec=$INSTALL_BIN/$BIN_NAME
Icon=$ICON_DIR/has.png
Terminal=false
Type=Application
Categories=AudioVideo;Player;Network;Utility;
StartupWMClass=home-autli-server
EOF
        chmod +x "$DESKTOP_DIR/home-autli-server.desktop"
        echo -e "${GREEN}✓ Исполняемый файл установлен в $INSTALL_BIN/$BIN_NAME${RESET}"
        echo -e "${GREEN}✓ Ярлык добавлен в меню приложений Arch / CachyOS.${RESET}"
        ;;
    appimage)
        echo -e "${BLUE}Настройка переносимого AppImage...${RESET}"
        chmod +x "$TMP_FILE"
        INSTALL_BIN="$HOME/.local/bin"
        mkdir -p "$INSTALL_BIN"
        mv "$TMP_FILE" "$INSTALL_BIN/$BIN_NAME"
        
        ICON_DIR="$HOME/.local/share/icons"
        mkdir -p "$ICON_DIR"
        curl -sL "https://raw.githubusercontent.com/${REPO}/main/public/logo.png" -o "$ICON_DIR/has.png" 2>/dev/null || true
        
        DESKTOP_DIR="$HOME/.local/share/applications"
        mkdir -p "$DESKTOP_DIR"
        cat <<EOF > "$DESKTOP_DIR/home-autli-server.desktop"
[Desktop Entry]
Name=Home Autli Server
Comment=Личный сервер, Кинотеатр и Хранилище
Exec=$INSTALL_BIN/$BIN_NAME
Icon=$ICON_DIR/has.png
Terminal=false
Type=Application
Categories=AudioVideo;Player;Network;Utility;
StartupWMClass=home-autli-server
EOF
        chmod +x "$DESKTOP_DIR/home-autli-server.desktop"
        echo -e "${GREEN}✓ Исполняемый файл установлен в $INSTALL_BIN/$BIN_NAME${RESET}"
        echo -e "${GREEN}✓ Ярлык добавлен в меню приложений.${RESET}"
        ;;
esac

echo ""
echo -e "${GREEN}${BOLD}==========================================================${RESET}"
echo -e "${GREEN}${BOLD}  🎉 ${APP_NAME} успешно установлен на ваш Linux!       ${RESET}"
echo -e "${GREEN}${BOLD}==========================================================${RESET}"
echo ""
echo -e "Вы можете запустить приложение:"
echo -e "  1. Из меню приложений вашего рабочего стола: ${BOLD}Home Autli Server${RESET}"
echo -e "  2. Или прямо в терминале командой: ${CYAN}${BOLD}has${RESET}"
echo ""
