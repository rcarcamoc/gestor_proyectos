# Script Maestro de Despliegue - Portal Unificado Zen
# Este script sincroniza el repositorio y redespliega todo en Oracle Cloud

$sshKey = "C:\Users\arant\.ssh\smarttrack_key.key"
$userAtHost = "ubuntu@161.153.219.141"
$remotePath = "portal_hub"

# Cambiar a la carpeta del script de forma robusta
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "[*] Iniciando despliegue del Portal Unificado..." -ForegroundColor Cyan

# 1. Sincronizar GitHub
Write-Host "[+] Subiendo cambios a GitHub..." -ForegroundColor Yellow
git add .
git commit -m "Unified Zen Portal Deployment"
git push origin main --force

# 2. Despliegue en el servidor
Write-Host "[+] Ejecutando comandos en Oracle Cloud..." -ForegroundColor Yellow

# Comandos formateados para evitar problemas de line-endings (\r)
$cmds = "mkdir -p $remotePath && cd $remotePath && " +
        "if [ -d .git ]; then git fetch origin main && git reset --hard origin/main; else git clone https://github.com/rcarcamoc/gestor_proyectos.git .; fi && " +
        "sudo docker rm -f smarttrack_frontend_prod smarttrack_backend_prod smarttrack_db_prod smarttrack_redis_prod smarttrack_telegram_bot_prod finanzas_app zen_portal 2>/dev/null || true && " +
        "sudo docker-compose up -d --build && " +
        "sudo docker image prune -f 2>/dev/null"

ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost "$cmds"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[V] Portal desplegado exitosamente en producción." -ForegroundColor Green
} else {
    Write-Host "[X] Error durante el despliegue en producción." -ForegroundColor Red
}
