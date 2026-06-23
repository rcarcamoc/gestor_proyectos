# Script Maestro de Despliegue - Portal Unificado Zen
# Este script sincroniza el repositorio y redespliega todo en Oracle Cloud

param(
    [switch]$Force
)

$sshKey = "C:\Users\arant\.ssh\smarttrack_key.key"
$userAtHost = "ubuntu@129.151.113.195"
$remotePath = "portal_hub"

# Cambiar a la carpeta del script de forma robusta
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "[*] Iniciando despliegue del Portal Unificado..." -ForegroundColor Cyan
if ($Force) {
    Write-Host "[!] Modo FORCE activo: se reconstruirá y migrará todo sin importar cambios." -ForegroundColor Yellow
}

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

# Pasar el parámetro Force al comando remoto
$forceBuildVal = "0"
if ($Force) {
    $forceBuildVal = "1"
}

# Comandos remotos optimizados
$remoteCmds = @'
mkdir -p REMOTE_PATH
cd REMOTE_PATH
if [ -d .git ]; then
    OLD_COMMIT=$(git rev-parse HEAD)
    git fetch origin main && git reset --hard origin/main
    NEW_COMMIT=$(git rev-parse HEAD)
else
    OLD_COMMIT="none"
    git clone https://github.com/rcarcamoc/gestor_proyectos.git .
    NEW_COMMIT=$(git rev-parse HEAD)
fi

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    CHANGED_FILES=""
    echo '[*] Sin cambios nuevos en el repositorio.'
else
    CHANGED_FILES=$(git diff --name-only $OLD_COMMIT $NEW_COMMIT)
    echo '[*] Archivos modificados en este commit:'
    echo "$CHANGED_FILES"
fi

if ! docker compose version >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y docker-compose-v2
fi

OLD_DB_ID=$(sudo docker ps -q --filter "name=smarttrack_db_prod")
OLD_DB_HEALTH=$(sudo docker inspect --format='{{.State.Health.Status}}' smarttrack_db_prod 2>/dev/null || echo "none")
NEEDS_BUILD=0
if [ "FORCE_VAL" -eq 1 ] || [ "$OLD_COMMIT" = "none" ] || echo "$CHANGED_FILES" | grep -qE "^(finanzas/|docker-compose\.yml|Dockerfile)"; then
    NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
    echo '[+] Compilando aplicacion de finanzas...'
    sudo docker compose build finanzas_app
else
    echo '[*] Sin cambios en finanzas o docker-compose. Omitiendo build.'
fi

echo '[+] Levantando servicios...'
sudo docker compose up -d db redis home finanzas_app

NEW_DB_ID=$(sudo docker ps -q --filter "name=smarttrack_db_prod")
if [ "$OLD_DB_ID" = "$NEW_DB_ID" ] && [ "$OLD_DB_HEALTH" = "healthy" ]; then
    echo '[*] Base de datos activa y saludable. Omitiendo espera.'
else
    echo '[+] Esperando a que la base de datos esté saludable...'
    wait_max=60
    counter=0
    until sudo docker ps --filter "name=smarttrack_db_prod" --filter "health=healthy" | grep -q "smarttrack_db_prod"; do
        sleep 2
        counter=$((counter + 2))
        if [ "$counter" -gt "$wait_max" ]; then
            echo '[X] DB Timeout'
            break
        fi
    done
fi

NEEDS_PUSH=0
if [ "FORCE_VAL" -eq 1 ] || [ "$OLD_COMMIT" = "none" ] || echo "$CHANGED_FILES" | grep -qE "schema\.prisma"; then
    NEEDS_PUSH=1
fi

if [ "$NEEDS_PUSH" -eq 1 ]; then
    echo '[+] Sincronizando esquema de base de datos con Prisma...'
    sudo docker exec finanzas_app npx prisma db push
else
    echo '[*] Sin cambios en schema.prisma. Omitiendo db push.'
fi

NEEDS_MIGRATE=0
if [ "FORCE_VAL" -eq 1 ] || [ "$OLD_COMMIT" = "none" ] || echo "$CHANGED_FILES" | grep -qE "(migrate_periods\.js|schema\.prisma)"; then
    NEEDS_MIGRATE=1
fi

if [ "$NEEDS_MIGRATE" -eq 1 ]; then
    echo '[+] Ejecutando migracion de periodos de facturacion...'
    sudo docker exec finanzas_app node migrate_periods.js
else
    echo '[*] Sin cambios en migracion. Omitiendo migrate_periods.'
fi

NEEDS_SEED=0
if [ "FORCE_VAL" -eq 1 ] || [ "$OLD_COMMIT" = "none" ] || echo "$CHANGED_FILES" | grep -qE "(seed\.ts|seed\.js|schema\.prisma)"; then
    NEEDS_SEED=1
fi

if [ "$NEEDS_SEED" -eq 1 ]; then
    echo '[+] Inicializando categorias por defecto...'
    sudo docker exec finanzas_app npx prisma db seed
else
    echo '[*] Sin cambios en datos de seed. Omitiendo db seed.'
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
    echo '[+] Limpiando imagenes antiguas...'
    sudo docker image prune -f
fi
'@.Replace("REMOTE_PATH", $remotePath).Replace("FORCE_VAL", $forceBuildVal)

$localTempFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($localTempFile, ($remoteCmds.Replace("`r", "") + "`n"))
scp -i "$sshKey" -o StrictHostKeyChecking=no $localTempFile "${userAtHost}:/tmp/deploy_temp.sh"
ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost "bash /tmp/deploy_temp.sh; rm -f /tmp/deploy_temp.sh"
Remove-Item $localTempFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[V] Portal desplegado y sincronizado exitosamente en producción." -ForegroundColor Green
    Write-Host "URL: http://129.151.113.195/" -ForegroundColor Gray
} else {
    Write-Host "`n[X] Error durante el despliegue en producción. Verifica la conexión o los logs de Docker." -ForegroundColor Red
}
