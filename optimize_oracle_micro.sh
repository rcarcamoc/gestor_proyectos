#!/bin/bash
# ============================================================
#  Oracle Free Tier - E2.1.Micro Optimizer
#  Ubuntu 24.04 | sa-santiago-1
#  Ricardo Cárcamo
# ============================================================

set -e

BOLD="\e[1m"
GREEN="\e[32m"
YELLOW="\e[33m"
CYAN="\e[36m"
RED="\e[31m"
RESET="\e[0m"

log()    { echo -e "${CYAN}[*]${RESET} $1"; }
ok()     { echo -e "${GREEN}[✓]${RESET} $1"; }
warn()   { echo -e "${YELLOW}[!]${RESET} $1"; }
header() { echo -e "\n${BOLD}${CYAN}══════ $1 ══════${RESET}"; }

# -------- Root check --------
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Ejecutar con sudo: sudo bash $0${RESET}"
  exit 1
fi

header "1 · DIAGNÓSTICO INICIAL"
log "RAM disponible:"
free -h
log "CPU / carga:"
uptime
log "Disco:"
df -h /
log "Swap actual:"
swapon --show || echo "Sin swap activo"

# -------- SWAP --------
header "2 · CONFIGURAR SWAP (512 MB)"
SWAPFILE=/swapfile
if [ ! -f "$SWAPFILE" ]; then
  log "Creando swapfile de 512 MB..."
  fallocate -l 512M $SWAPFILE
  chmod 600 $SWAPFILE
  mkswap $SWAPFILE
  swapon $SWAPFILE
  grep -q "$SWAPFILE" /etc/fstab || echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
  ok "Swapfile creado y activado"
else
  warn "Swapfile ya existe, omitiendo"
fi

header "3 · SYSCTL - PARÁMETROS DEL KERNEL"
SYSCTL_CONF=/etc/sysctl.d/99-oracle-micro.conf

cat > $SYSCTL_CONF << 'SYSCTL'
# Oracle Free Tier - E2.1.Micro optimizations
# Reduce swap aggression (RAM primero, swap solo en emergencia)
vm.swappiness=10

# Cache de inodos/dentries más agresiva (mejor para file I/O)
vm.vfs_cache_pressure=50

# Escrituras diferidas - reduce I/O en disco
vm.dirty_ratio=15
vm.dirty_background_ratio=5

# Red - buffers más eficientes para instancias con poco RAM
net.core.rmem_default=65536
net.core.wmem_default=65536
net.core.rmem_max=4194304
net.core.wmem_max=4194304

# Reusar sockets TIME_WAIT (útil para servidores web/API)
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_fin_timeout=15

# Más conexiones pendientes
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=2048

# Protección SYN flood (no gasta RAM con conexiones falsas)
net.ipv4.tcp_syncookies=1

# Menos uso de memoria en IPv6 si no la usas
net.ipv6.conf.all.disable_ipv6=0
SYSCTL

sysctl -p $SYSCTL_CONF > /dev/null
ok "Parámetros de kernel aplicados: $SYSCTL_CONF"

header "4 · NOATIME EN BOOT VOLUME"
# Monta la raíz con noatime para reducir escrituras por lectura de archivos
if ! grep -q "noatime" /etc/fstab; then
  # Backup primero
  cp /etc/fstab /etc/fstab.bak
  warn "Se requiere remount manual para aplicar noatime sin reiniciar"
  log "Monta temporalmente con noatime:"
  mount -o remount,noatime / && ok "Remontado con noatime (temporal)" || warn "No se pudo remontar, se aplicará en el próximo boot"
  log "Para hacerlo permanente en /etc/fstab, añade 'noatime' en las opciones del volumen raíz"
else
  ok "noatime ya configurado en /etc/fstab"
fi

header "5 · JOURNALD - LIMITAR LOGS"
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/oracle-micro.conf << 'JOURNALD'
[Journal]
SystemMaxUse=50M
RuntimeMaxUse=30M
MaxFileSec=7day
Compress=yes
JOURNALD

systemctl restart systemd-journald
ok "journald configurado (máx 50 MB en disco)"

header "6 · DESHABILITAR SERVICIOS INNECESARIOS"
SERVICES=(
  "snapd"
  "snapd.socket"
  "snapd.seeded"
  "bluetooth"
  "cups"
  "cups-browsed"
  "avahi-daemon"
  "ModemManager"
  "whoopsie"
  "apport"
  "lxd"
)

for svc in "${SERVICES[@]}"; do
  if systemctl is-active --quiet "$svc" 2>/dev/null || systemctl is-enabled --quiet "$svc" 2>/dev/null; then
    systemctl disable --now "$svc" 2>/dev/null && ok "Deshabilitado: $svc" || warn "No encontrado o ya inactivo: $svc"
  else
    log "Ya inactivo: $svc"
  fi
done

header "7 · TMPFS PARA /tmp"
if ! grep -q "tmpfs /tmp" /etc/fstab; then
  echo "tmpfs /tmp tmpfs defaults,noatime,nosuid,nodev,size=128M 0 0" >> /etc/fstab
  mount -o remount /tmp 2>/dev/null || mount tmpfs /tmp -t tmpfs -o size=128M 2>/dev/null || warn "/tmp ya montado, se aplicará en próximo boot"
  ok "tmpfs configurado para /tmp (128 MB en RAM)"
else
  ok "tmpfs en /tmp ya configurado"
fi

header "8 · LIMPIEZA DE PAQUETES"
log "Limpiando paquetes huérfanos y cachés de apt..."
apt-get autoremove -y -q 2>/dev/null
apt-get autoclean -q 2>/dev/null
ok "Cache de apt limpiado"

# Limpiar snapd si existe
if command -v snap &> /dev/null; then
  log "Removiendo snaps no esenciales..."
  snap list 2>/dev/null | grep -v "^Name" | awk '{print $1}' | grep -E "^(lxd|core[0-9]*)$" | while read snap; do
    snap remove --purge "$snap" 2>/dev/null && ok "Snap removido: $snap" || true
  done
fi

header "9 · ESTADO FINAL"
ok "RAM después de optimización:"
free -h
ok "Swap activo:"
swapon --show
ok "Servicios activos (top consumidores):"
systemctl list-units --type=service --state=running --no-pager | head -20
ok "Espacio en disco:"
df -h /

header "RESUMEN DE CAMBIOS"
echo -e "
${GREEN}✓ Swap 512 MB creado/activado${RESET}
${GREEN}✓ vm.swappiness=10 (kernel usa RAM primero)${RESET}
${GREEN}✓ vm.vfs_cache_pressure=50 (mejor I/O de archivos)${RESET}
${GREEN}✓ Buffers de red optimizados${RESET}
${GREEN}✓ tcp_tw_reuse=1 (sockets más eficientes)${RESET}
${GREEN}✓ noatime aplicado (menos escrituras en disco)${RESET}
${GREEN}✓ journald limitado a 50 MB${RESET}
${GREEN}✓ Servicios innecesarios deshabilitados${RESET}
${GREEN}✓ /tmp en tmpfs (128 MB en RAM)${RESET}
${GREEN}✓ Cache apt limpiado${RESET}

${YELLOW}Recomendación: reiniciar para que todos los cambios surtan efecto completo.${RESET}
${CYAN}sudo reboot${RESET}
"
