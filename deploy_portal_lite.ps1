# Script de Despliegue Ligero (Lite) - Portal Unificado Zen
# Sincroniza archivos locales directamente sin pasar por GitHub y compila local/remoto según se requiera.

param(
    [switch]$Force,
    [switch]$LocalBuild
)

$sshKey = "C:\Users\arant\.ssh\smarttrack_key.key"
$userAtHost = "ubuntu@129.151.113.195"
$remotePath = "portal_hub"

# Cambiar a la carpeta del script de forma robusta
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "[*] Iniciando DESPLIEGUE LITE del Portal Unificado..." -ForegroundColor Cyan
if ($Force) {
    Write-Host "[!] Modo FORCE activo: se reconstruirá y migrará todo en caliente." -ForegroundColor Yellow
}
if ($LocalBuild) {
    Write-Host "[!] Modo LOCAL BUILD activo: la imagen se compilará localmente." -ForegroundColor Yellow
}

# 1. Validar que la llave SSH exista
if (!(Test-Path $sshKey)) {
    Write-Host "[X] Error: No se encontró la llave SSH en $sshKey" -ForegroundColor Red
    exit
}

# 2. Compilación local si se solicita LocalBuild
if ($LocalBuild) {
    Write-Host "[+] Compilando imagen Docker localmente (finanzas_app)..." -ForegroundColor Yellow
    
    # Intentar build local
    docker compose build finanzas_app
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Error al compilar la imagen localmente. Asegúrate de tener Docker Desktop corriendo." -ForegroundColor Red
        exit
    }
    
    Write-Host "[+] Exportando imagen compilada a tarball..." -ForegroundColor Yellow
    $localTarImage = "finanzas_app.tar.gz"
    docker save finanzas_app:latest | gzip > $localTarImage
    
    Write-Host "[+] Transfiriendo imagen compilada al servidor OCI (~100-200MB)..." -ForegroundColor Yellow
    scp -i "$sshKey" -o StrictHostKeyChecking=no $localTarImage "${userAtHost}:/tmp/$localTarImage"
    
    # Limpiar archivo temporal local
    Remove-Item $localTarImage -Force
}

# 3. Sincronización directa del código fuente (Lite) sin pasar por GitHub
Write-Host "[+] Empaquetando código fuente local (excluyendo node_modules, .next, etc)..." -ForegroundColor Yellow
$tarFile = "portal_lite.tar.gz"

# Ejecutar tar (nativo en Windows 10/11)
tar -czf $tarFile --exclude="node_modules" --exclude=".next" --exclude=".git" --exclude="*.tar.gz" --exclude="gestor/node_modules" --exclude="finanzas/node_modules" --exclude="finanzas/.next" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Error al empaquetar el código fuente." -ForegroundColor Red
    exit
}

Write-Host "[+] Subiendo código empaquetado al servidor..." -ForegroundColor Yellow
scp -i "$sshKey" -o StrictHostKeyChecking=no $tarFile "${userAtHost}:/tmp/$tarFile"
Remove-Item $tarFile -Force

# 4. Obtener GROQ_API_KEY de finanzas/.env local
$localEnvFile = Join-Path $ScriptDir "finanzas\.env"
$groqKey = ""
if (Test-Path $localEnvFile) {
    $envContent = Get-Content $localEnvFile
    foreach ($line in $envContent) {
        if ($line -match "^GROQ_API_KEY=(.*)$") {
            $groqKey = $Matches[1].Trim()
        }
    }
}

# Construcción de comandos remotos optimizados para el deploy lite
$forceBuildVal = if ($Force) { "1" } else { "0" }
$localBuildVal = if ($LocalBuild) { "1" } else { "0" }

$remoteCmds = @'
mkdir -p REMOTE_PATH
cd REMOTE_PATH

# A. Descomprimir el código fuente subido
if [ -f /tmp/portal_lite.tar.gz ]; then
    echo '[+] Extrayendo codigo fuente sobre el directorio de trabajo...'
    tar -xzf /tmp/portal_lite.tar.gz --warning=no-unknown-keyword -C .
    rm -f /tmp/portal_lite.tar.gz
fi

# B. Si se subió build local de docker, cargarlo en el docker del host
LOADED_LOCAL_BUILD=0
if [ "LOCAL_BUILD_VAL" -eq 1 ] && [ -f /tmp/finanzas_app.tar.gz ]; then
    echo '[+] Cargando imagen compilada localmente en Docker...'
    docker load < /tmp/finanzas_app.tar.gz
    rm -f /tmp/finanzas_app.tar.gz
    LOADED_LOCAL_BUILD=1
fi

# C. Detectar qué archivos cambiaron con respecto al último commit guardado en el servidor
CHANGED_FILES=$(git status --porcelain | sed 's/^...//')
echo '[*] Archivos locales modificados detectados en el servidor:'
if [ -n "$CHANGED_FILES" ]; then
    echo "$CHANGED_FILES"
else
    echo "(Ninguno)"
fi

if ! docker compose version >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y docker-compose-v2
fi

if [ -d finanzas ]; then
    echo "DATABASE_URL=mysql://user:pass@db:3306/web_finanzas" > finanzas/.env
    echo "NEXTAUTH_URL=http://localhost/finanzas" >> finanzas/.env
    echo "NEXTAUTH_SECRET=y0ur_v3ry_s3cr3t_n3xt_4uth_k3y" >> finanzas/.env
    echo "GROQ_API_KEY=GROQ_KEY_VAL" >> finanzas/.env
fi

# D. Determinar si requiere compilar la imagen
NEEDS_BUILD=0
if [ "$LOADED_LOCAL_BUILD" -eq 0 ]; then
    if [ "FORCE_VAL" -eq 1 ] || echo "$CHANGED_FILES" | grep -qE "^(finanzas/|docker-compose\.yml|Dockerfile)"; then
        NEEDS_BUILD=1
    fi
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
    echo '[+] Compilando aplicacion de finanzas en el servidor...'
    sudo docker compose build finanzas_app
else
    if [ "$LOADED_LOCAL_BUILD" -eq 1 ]; then
        echo '[*] Omitiendo compilacion en el servidor (usando imagen cargada localmente).'
    else
        echo '[*] Sin cambios en finanzas o docker-compose. Omitiendo build remoto.'
    fi
fi

echo '[+] Iniciando/actualizando servicios...'
sudo docker compose up -d db redis home finanzas_app

# E. Esperar base de datos
OLD_DB_ID=$(sudo docker ps -q --filter "name=smarttrack_db_prod")
OLD_DB_HEALTH=$(sudo docker inspect --format='{{.State.Health.Status}}' smarttrack_db_prod 2>/dev/null || echo "none")

if [ "$OLD_DB_HEALTH" != "healthy" ]; then
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

# F. Prisma push / migrations / seeds
NEEDS_PUSH=0
if [ "FORCE_VAL" -eq 1 ] || echo "$CHANGED_FILES" | grep -qE "schema\.prisma"; then
    NEEDS_PUSH=1
fi

if [ "$NEEDS_PUSH" -eq 1 ]; then
    echo '[+] Sincronizando esquema de base de datos con Prisma...'
    sudo docker exec finanzas_app npx prisma db push
else
    echo '[*] Sin cambios en schema.prisma. Omitiendo db push.'
fi

NEEDS_MIGRATE=0
if [ "FORCE_VAL" -eq 1 ] || echo "$CHANGED_FILES" | grep -qE "(migrate_periods\.js|schema\.prisma)"; then
    NEEDS_MIGRATE=1
fi

if [ "$NEEDS_MIGRATE" -eq 1 ]; then
    echo '[+] Ejecutando migracion de periodos de facturacion...'
    sudo docker exec finanzas_app node migrate_periods.js
else
    echo '[*] Sin cambios en migracion. Omitiendo migrate_periods.'
fi

NEEDS_SEED=0
if [ "FORCE_VAL" -eq 1 ] || echo "$CHANGED_FILES" | grep -qE "(seed\.ts|seed\.js|schema\.prisma)"; then
    NEEDS_SEED=1
fi

if [ "$NEEDS_SEED" -eq 1 ]; then
    echo '[+] Inicializando categorias por defecto...'
    sudo docker exec finanzas_app npx prisma db seed
else
    echo '[*] Sin cambios en datos de seed. Omitiendo db seed.'
fi

if [ "$NEEDS_BUILD" -eq 1 ] || [ "$LOADED_LOCAL_BUILD" -eq 1 ]; then
    echo '[+] Limpiando imagenes antiguas de Docker...'
    sudo docker image prune -f
fi
'@.Replace("REMOTE_PATH", $remotePath).Replace("FORCE_VAL", $forceBuildVal).Replace("LOCAL_BUILD_VAL", $localBuildVal).Replace("GROQ_KEY_VAL", $groqKey)

$localTempFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($localTempFile, ($remoteCmds.Replace("`r", "") + "`n"))
scp -i "$sshKey" -o StrictHostKeyChecking=no $localTempFile "${userAtHost}:/tmp/deploy_temp_lite.sh"
ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost "bash /tmp/deploy_temp_lite.sh; rm -f /tmp/deploy_temp_lite.sh"
Remove-Item $localTempFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[V] Portal desplegado de forma LITE exitosamente en producción." -ForegroundColor Green
    Write-Host "URL: http://129.151.113.195/" -ForegroundColor Gray
} else {
    Write-Host "`n[X] Error durante el despliegue ligero." -ForegroundColor Red
}
