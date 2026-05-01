# Script Maestro de Despliegue - Portal Unificado Zen
# Este script sincroniza el repositorio y redespliega todo en Oracle Cloud

$sshKey = "C:\Users\arant\.ssh\smarttrack_key.key"
$userAtHost = "ubuntu@161.153.219.141"
$remotePath = "portal_hub" # Nueva carpeta en el servidor para evitar conflictos con la anterior

Write-Host "[*] Iniciando despliegue del Portal Unificado..." -ForegroundColor Cyan

# 1. Sincronizar GitHub (Asumiendo que ya se hizo el commit local)
Write-Host "[+] Subiendo cambios a GitHub..." -ForegroundColor Yellow
git add .
git commit -m "Unified Zen Portal Deployment"
git push origin main --force

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Error al subir a GitHub o no hay cambios." -ForegroundColor Gray
}

# 2. Despliegue en el servidor
Write-Host "[+] Ejecutando comandos en Oracle Cloud..." -ForegroundColor Yellow

$remoteCommands = @"
mkdir -p $remotePath && cd $remotePath
if [ -d .git ]; then
    git fetch origin main && git reset --hard origin/main
else
    git clone https://github.com/rcarcamoc/gestor_proyectos.git .
fi

# Detener contenedores viejos de SmartTrack si existen (limpieza)
sudo docker rm -f smarttrack_frontend_prod smarttrack_backend_prod smarttrack_db_prod smarttrack_redis_prod smarttrack_telegram_bot_prod finanzas_app zen_portal || true

# Levantar el nuevo orquestador maestro
sudo docker-compose up -d --build
sudo docker image prune -f
"@

ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost $remoteCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "[V] Portal desplegado exitosamente en producción." -ForegroundColor Green
} else {
    Write-Host "[X] Error durante el despliegue en producción." -ForegroundColor Red
}
