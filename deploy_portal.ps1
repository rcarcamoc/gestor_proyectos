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
Write-Host "[+] Verificando cambios locales..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "[+] Subiendo cambios a GitHub..." -ForegroundColor Yellow
    git add .
    git commit -m "Unified Zen Portal Deployment - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git push origin main --force
} else {
    Write-Host "[*] No hay cambios locales para subir." -ForegroundColor Gray
}

# 2. Despliegue en el servidor
Write-Host "[+] Ejecutando comandos en Oracle Cloud..." -ForegroundColor Yellow

# Comandos remotos
$cmds = "mkdir -p $remotePath && cd $remotePath && " +
        "if [ -d .git ]; then " +
            "git fetch origin main && git reset --hard origin/main; " +
        "else " +
            "git clone https://github.com/rcarcamoc/gestor_proyectos.git .; " +
        "fi && " +
        "if ! docker compose version >/dev/null 2>&1; then " +
            "echo '[!] Docker Compose V2 no encontrado. Intentando instalar docker-compose-v2...' && " +
            "sudo apt-get update && sudo apt-get install -y docker-compose-v2; " +
        "fi && " +
        "sudo docker compose down && " +
        "sudo docker compose up -d --build --force-recreate && " +
        "echo '[+] Esperando estabilidad de contenedores...' && sleep 10 && " +
        "sudo docker exec finanzas_app npx prisma db push --accept-data-loss && " +
        "sudo docker exec finanzas_app npx prisma db seed && " +
        "sudo docker image prune -f 2>/dev/null"

ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost "$cmds"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[V] Portal desplegado y sincronizado exitosamente en producción." -ForegroundColor Green
    Write-Host "URL: http://161.153.219.141/" -ForegroundColor Gray
} else {
    Write-Host "`n[X] Error durante el despliegue en producción." -ForegroundColor Red
}
