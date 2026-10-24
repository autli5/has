# Maintainer: autli5 <https://github.com/autli5>
pkgname=home-autli-server-bin
pkgver=0.1.5
pkgrel=1
pkgdesc="Home Autli Server (HAS) - Кинотеатр (Full HD + Русская озвучка) и Облачное хранилище"
arch=('x86_64')
url="https://github.com/autli5/has"
license=('custom')
depends=('webkit2gtk-4.1' 'libappindicator-gtk3' 'librsvg' 'openssl' 'hicolor-icon-theme')
options=(!strip)

source=(
    "https://github.com/autli5/has/releases/download/v${pkgver}/home-autli-server_${pkgver}_amd64.deb"
    "https://raw.githubusercontent.com/autli5/has/main/public/logo.png"
)
sha256sums=(
    'SKIP'
    'SKIP'
)

package() {
    # Распаковываем DEB пакет
    tar -xf data.tar.* -C "${pkgdir}/"
    
    # Устанавливаем логотип
    install -Dm644 "${srcdir}/logo.png" "${pkgdir}/usr/share/icons/hicolor/512x512/apps/has.png"
    
    # Создаем симлинк для быстрого запуска через 'has' в терминале
    mkdir -p "${pkgdir}/usr/bin"
    ln -sf "/usr/bin/home-autli-server" "${pkgdir}/usr/bin/has"
}
