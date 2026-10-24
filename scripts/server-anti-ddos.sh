#!/bin/bash
# ==============================================================================
# HAS Server Anti-DDoS & Port 5432 Protection Setup Script
# ==============================================================================
# This script hardens Ubuntu server against:
# 1. TCP SYN Flood & Connection Exhaustion DDoS
# 2. Port 5432 Port Scanning, Connection Floods & Slowloris
# 3. PostgreSQL Brute-Force & Credential Stuffing
# 4. Kernel Socket & Memory Exhaustion Attacks
# ==============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}       HAS SERVER ANTI-DDOS & PORT 5432 HARDENING SETUP             ${NC}"
echo -e "${BLUE}====================================================================${NC}"

# 1. Check Root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Пожалуйста, запустите скрипт с правами суперпользователя: sudo bash $0${NC}"
    exit 1
fi

echo -e "\n${YELLOW}>>> 1/5. Настройка ядра Linux против SYN Flood и DoS атак...${NC}"

SYSCTL_CONF="/etc/sysctl.d/99-has-anti-ddos.conf"
cat << 'EOF' > "$SYSCTL_CONF"
# --- HAS Anti-DDoS Kernel Protection ---
# 1. SYN Flood Protection (Cryptographic SYN cookies when queue is under attack)
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 3

# 2. Fast timeout for abandoned and dead connections (Anti-Slowloris)
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 30
net.ipv4.tcp_keepalive_intvl = 10
net.ipv4.tcp_keepalive_probes = 3

# 3. Socket reuse & connection scaling
net.ipv4.tcp_tw_reuse = 1
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 5000
net.ipv4.ip_local_port_range = 1024 65535

# 4. Anti-Spoofing & Broadcast ICMP flood protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
EOF

sysctl -p "$SYSCTL_CONF" >/dev/null 2>&1 || sysctl --system >/dev/null 2>&1
echo -e "${GREEN}✓ Параметры ядра sysctl применены: SYN-cookies включены, таймауты сброшены.${NC}"

# 2. Iptables Rate-Limiting & Connection Limits on Port 5432
echo -e "\n${YELLOW}>>> 2/5. Настройка фаервола iptables на порту 5432...${NC}"

# Ensure iptables-persistent is installed
if ! command -v iptables &> /dev/null; then
    apt-get update -y && apt-get install -y iptables
fi

export DEBIAN_FRONTEND=noninteractive
apt-get install -y iptables-persistent netfilter-persistent >/dev/null 2>&1 || true

# Remove older duplicate HAS rules if any
iptables -D INPUT -p tcp --dport 5432 -m connlimit --connlimit-above 10 --connlimit-mask 32 -j REJECT --reject-with tcp-reset 2>/dev/null || true
iptables -D INPUT -p tcp --dport 5432 -m state --state NEW -m recent --update --seconds 10 --hitcount 20 --name HAS_PG_RATE -j DROP 2>/dev/null || true
iptables -D INPUT -p tcp --dport 5432 -m state --state NEW -m recent --set --name HAS_PG_RATE 2>/dev/null || true
iptables -D INPUT -p tcp --dport 5432 --syn -m limit --limit 30/s --limit-burst 60 -j ACCEPT 2>/dev/null || true

# RULE A: Limit max concurrent connections per single IP to 10
# (Real app uses 1-3 connections; botnet opening 50+ sockets gets immediate TCP RST)
iptables -I INPUT -p tcp --dport 5432 -m connlimit --connlimit-above 10 --connlimit-mask 32 -j REJECT --reject-with tcp-reset

# RULE B: Rate-limit new connections (Anti-Scan / Anti-Burst Flood)
# (Max 20 new connections per 10 seconds per IP, rest are dropped silently)
iptables -I INPUT -p tcp --dport 5432 -m state --state NEW -m recent --update --seconds 10 --hitcount 20 --name HAS_PG_RATE -j DROP
iptables -I INPUT -p tcp --dport 5432 -m state --state NEW -m recent --set --name HAS_PG_RATE

# RULE C: SYN flood packet rate limiting
iptables -I INPUT -p tcp --dport 5432 --syn -m limit --limit 30/s --limit-burst 60 -j ACCEPT

# Save iptables rules to persist across reboot
if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save >/dev/null 2>&1 || true
fi
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
echo -e "${GREEN}✓ Iptables настроен: макс. 10 подключений на 1 IP, лимит новых сессий (20/10с), защита от SYN-flood.${NC}"

# 3. Hardening PostgreSQL Server (postgresql.conf)
echo -e "\n${YELLOW}>>> 3/5. Оптимизация параметров безопасности PostgreSQL...${NC}"

PG_CONF=""
for p in "/www/server/pgsql/data/postgresql.conf" $(find /etc/postgresql -name postgresql.conf 2>/dev/null); do
    if [ -f "$p" ]; then
        PG_CONF="$p"
        break
    fi
done

if [ -n "$PG_CONF" ] && [ -f "$PG_CONF" ]; then
    echo -e "Найден конфигурационный файл: ${BLUE}$PG_CONF${NC}"
    cp "$PG_CONF" "${PG_CONF}.bak_$(date +%Y%m%d%H%M%S)"

    # Anti-Slowloris: reduce authentication timeout from 60s to 5s
    sed -i "s/^#\?authentication_timeout\s*=.*/authentication_timeout = 5s/" "$PG_CONF"

    # Fast keepalive for dead client connections
    sed -i "s/^#\?tcp_keepalives_idle\s*=.*/tcp_keepalives_idle = 15/" "$PG_CONF"
    sed -i "s/^#\?tcp_keepalives_interval\s*=.*/tcp_keepalives_interval = 5/" "$PG_CONF"
    sed -i "s/^#\?tcp_keepalives_count\s*=.*/tcp_keepalives_count = 3/" "$PG_CONF"

    # Connection limits & admin reservation
    sed -i "s/^#\?max_connections\s*=.*/max_connections = 120/" "$PG_CONF"
    sed -i "s/^#\?superuser_reserved_connections\s*=.*/superuser_reserved_connections = 5/" "$PG_CONF"

    # Reload PostgreSQL configuration without downtime
    if [ -f "/www/server/pgsql/bin/pg_ctl" ]; then
        su - postgres -c "/www/server/pgsql/bin/pg_ctl -D /www/server/pgsql/data reload" >/dev/null 2>&1 || true
    elif [ -f "/etc/init.d/pgsql" ]; then
        /etc/init.d/pgsql reload >/dev/null 2>&1 || true
    else
        systemctl reload postgresql >/dev/null 2>&1 || true
    fi
    echo -e "${GREEN}✓ PostgreSQL обновлен: authentication_timeout=5s (Anti-Slowloris), keepalive=15s, резерв для админа.${NC}"
else
    echo -e "${YELLOW}⚠️ Файл postgresql.conf не найден автоматически, пропуск обновления параметров PG.${NC}"
fi

# 4. Setup Fail2Ban against Brute-Force & Malicious Scanners
echo -e "\n${YELLOW}>>> 4/5. Настройка Fail2ban для автоматической блокировки атакующих ботов...${NC}"

apt-get update -y >/dev/null 2>&1 || true
apt-get install -y fail2ban >/dev/null 2>&1 || true

if command -v fail2ban-client &> /dev/null; then
    mkdir -p /etc/fail2ban/filter.d /etc/fail2ban/jail.d

    cat << 'EOF' > /etc/fail2ban/filter.d/postgresql-has.conf
[Definition]
failregex = ^.*FATAL:\s+password authentication failed for user.*host=<HOST>.*$
            ^.*FATAL:\s+no pg_hba.conf entry for host "<HOST>".*$
ignoreregex =
EOF

    PG_LOG="/www/server/pgsql/data/server.log"
    if [ ! -f "$PG_LOG" ]; then
        PG_LOG="/var/log/postgresql/postgresql-*.log"
    fi

    cat << EOF > /etc/fail2ban/jail.d/postgresql-has.local
[postgresql-has]
enabled = true
port = 5432
filter = postgresql-has
logpath = $PG_LOG
maxretry = 5
findtime = 600
bantime = 86400
EOF

    systemctl restart fail2ban >/dev/null 2>&1 || service fail2ban restart >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ Fail2ban активирован: автобан на 24 часа при 5 неудачных попытках авторизации.${NC}"
else
    echo -e "${YELLOW}⚠️ Fail2ban не удалось установить автоматически.${NC}"
fi

# 5. Verification & Status Output
echo -e "\n${BLUE}====================================================================${NC}"
echo -e "${GREEN}🎉 НАСТРОЙКА ЗАЩИТЫ УСПЕШНО ЗАВЕРШЕНА!${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Активные правила iptables на порту 5432:"
iptables -L INPUT -v -n --line-numbers | grep -E "5432|dpt" || true

echo -e "\n${YELLOW}Полезные команды для мониторинга сервера:${NC}"
echo -e "1. Просмотр заблокированных ботов в Fail2ban: ${GREEN}fail2ban-client status postgresql-has${NC}"
echo -e "2. Просмотр счетчика отброшенных пакетов:     ${GREEN}iptables -L INPUT -v -n | grep 5432${NC}"
echo -e "3. Просмотр активных соединений с базой:      ${GREEN}ss -nt state established '( sport = :5432 )'${NC}"
echo -e "4. Разблокировать ошибочно забаненный IP:     ${GREEN}fail2ban-client set postgresql-has unbanip <IP>${NC}"
echo -e "${BLUE}====================================================================${NC}"
