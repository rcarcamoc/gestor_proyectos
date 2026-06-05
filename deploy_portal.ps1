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

if (!(Test-Path $sshKey)) {
    Write-Host "[X] Error: No se encontró la llave SSH en $sshKey" -ForegroundColor Red
    exit
}

# Comandos remotos optimizados
$remoteCmds = @'
mkdir -p REMOTE_PATH && cd REMOTE_PATH && \
if [ -d .git ]; then \
    git fetch origin main && git reset --hard origin/main; \
else \
    git clone https://github.com/rcarcamoc/gestor_proyectos.git .; \
fi && \
if ! docker compose version >/dev/null 2>&1; then \
    sudo apt-get update && sudo apt-get install -y docker-compose-v2; \
fi && \
echo '[+] Compilando servicios secuencialmente para ahorrar RAM...' && \
sudo docker compose build gestor_backend && \
sudo docker compose build gestor_bot && \
sudo docker compose build gestor_frontend && \
sudo docker compose build finanzas_app && \
echo '[+] Actualizando contenedores en caliente (Zero Downtime)...' && \
sudo docker compose up -d --remove-orphans && \
echo '[+] Esperando a que la base de datos esté saludable...' && \
wait_max=60; counter=0; \
 until sudo docker ps --filter "name=smarttrack_db_prod" --filter "health=healthy" | grep -q "smarttrack_db_prod"; do \
     sleep 2; \
     counter=$((counter + 2)); \
     if [ "$counter" -gt "$wait_max" ]; then echo '[X] DB Timeout'; break; fi; \
 done && \
echo '[+] Sincronizando esquema de base de datos...' && \
sudo docker exec finanzas_app npx prisma db push && \
echo '[+] Inicializando categorias por defecto...' && \
sudo docker exec finanzas_app npx prisma db seed && \
echo '[+] Limpiando imágenes antiguas...' && \
sudo docker image prune -f
'@.Replace("REMOTE_PATH", $remotePath)

ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost "$remoteCmds"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[V] Portal desplegado y sincronizado exitosamente en producción." -ForegroundColor Green
    Write-Host "URL: http://161.153.219.141/" -ForegroundColor Gray
} else {
    Write-Host "`n[X] Error durante el despliegue en producción. Verifica la conexión o los logs de Docker." -ForegroundColor Red
}
