# Script de Despliegue Exclusivo y Ultra-Ligero para Finanzas (finanzas_app)
# Este script actualiza ÚNICAMENTE el contenedor finanzas_app de Docker.
#
# CONSEJO DE USO (Oracle Free Tier - 1 GB RAM):
# Se recomienda usar SIEMPRE el flag `-LocalBuild` para evitar congelamientos en el servidor:
#    .\deploy_finanzas_only.ps1 -LocalBuild
# Esto compila Next.js en tu PC, empaqueta la imagen Docker y la sube lista para correr.

param(
    [switch]$Force,
    [bool]$LocalBuild = $true
)

$sshKey = "C:\Users\arant\.ssh\smarttrack_key.key"
$userAtHost = "ubuntu@129.151.113.195"
$remotePath = "portal_hub"

# Cambiar a la carpeta del script de forma robusta
$ScriptDir = $PSScriptRoot
Set-Location $ScriptDir

Write-Host "[*] Iniciando DESPLIEGUE ULTRA-LIGERO para finanzas_app..." -ForegroundColor Cyan
if ($LocalBuild) {
    Write-Host "[!] Modo LOCAL BUILD activo: la imagen se compilará localmente." -ForegroundColor Yellow
} else {
    Write-Host "[!] Compilación remota activa (¡Cuidado con la RAM del servidor!)." -ForegroundColor Yellow
}

# 1. Validar que la llave SSH exista
if (!(Test-Path $sshKey)) {
    Write-Host "[X] Error: No se encontró la llave SSH en $sshKey" -ForegroundColor Red
    exit
}

# 2. Compilación local e importación (Si se solicita LocalBuild)
if ($LocalBuild) {
    # Verificar si el daemon de Docker está activo
    & docker info >$null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] El daemon de Docker no está activo. Intentando iniciar Docker Desktop automáticamente..." -ForegroundColor Yellow
        
        $dockerPaths = @(
            "C:\Program Files\Docker\Docker\Docker Desktop.exe",
            "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
        )
        $dockerStarted = $false
        foreach ($path in $dockerPaths) {
            if (Test-Path $path) {
                Start-Process -FilePath $path
                $dockerStarted = $true
                break
            }
        }
        
        if (-not $dockerStarted) {
            try {
                Start-Process -FilePath "Docker Desktop.exe" -ErrorAction Stop
                $dockerStarted = $true
            } catch {
                Write-Host "[X] No se pudo encontrar la ruta de Docker Desktop. Por favor inícialo manualmente." -ForegroundColor Red
                exit
            }
        }
        
        Write-Host "[*] Esperando hasta 60 segundos a que Docker se inicialice y responda..." -ForegroundColor Yellow
        $waitLimit = 60
        $dockerReady = $false
        while ($waitLimit -gt 0) {
            & docker info >$null 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dockerReady = $true
                break
            }
            Start-Sleep -Seconds 2
            $waitLimit -= 2
        }
        
        if (-not $dockerReady) {
            Write-Host "[X] Docker Desktop no se inició a tiempo. Abortando despliegue." -ForegroundColor Red
            exit
        }
        Write-Host "[V] Docker Desktop está listo y respondiendo." -ForegroundColor Green
    }

    Write-Host "[+] Compilando imagen Docker localmente (finanzas_app)..." -ForegroundColor Yellow
    
    # Intentar build local
    docker compose build finanzas_app
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Error al compilar la imagen localmente. Asegúrate de tener Docker Desktop ejecutándose." -ForegroundColor Red
        exit
    }
    
    Write-Host "[+] Exportando imagen compilada a tarball..." -ForegroundColor Yellow
    $localTarImage = "finanzas_app.tar.gz"
    
    # Guardar la imagen localmente como tar y comprimirla usando tar nativo de Windows
    docker save -o finanzas_app.tar portal-finanzas_app:latest
    if ($LASTEXITCODE -ne 0) {
        docker save -o finanzas_app.tar finanzas_app:latest
    }
    if ($LASTEXITCODE -ne 0 -or !(Test-Path "finanzas_app.tar")) {
        Write-Host "[X] Error al exportar la imagen local." -ForegroundColor Red
        exit
    }
    
    # Comprimir usando tar nativo (que soporta compresión gzip integrada)
    tar -czf $localTarImage finanzas_app.tar
    Remove-Item finanzas_app.tar -Force
    
    if (!(Test-Path $localTarImage)) {
        Write-Host "[X] Error al comprimir el archivo tar de la imagen." -ForegroundColor Red
        exit
    }
    
    Write-Host "[+] Transfiriendo imagen compilada al servidor OCI..." -ForegroundColor Yellow
    scp -i "$sshKey" -o StrictHostKeyChecking=no $localTarImage "${userAtHost}:~/$localTarImage"
    
    Remove-Item $localTarImage -Force
}

# 3. Empaquetar y subir el código fuente de finanzas únicamente (excluyendo node_modules, .next, etc.)
Write-Host "[+] Empaquetando código fuente de finanzas..." -ForegroundColor Yellow
$tarFile = "finanzas_lite.tar.gz"

# Comprimir solo la carpeta 'finanzas'
tar -czf $tarFile --exclude="node_modules" --exclude=".next" --exclude=".git" --exclude="*.tar.gz" finanzas
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Error al empaquetar el código fuente." -ForegroundColor Red
    exit
}

Write-Host "[+] Subiendo código de finanzas al servidor..." -ForegroundColor Yellow
scp -i "$sshKey" -o StrictHostKeyChecking=no $tarFile "${userAtHost}:~/$tarFile"
Remove-Item $tarFile -Force

# 4. Obtener GROQ_API_KEY localmente
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

$forceBuildVal = if ($Force) { "1" } else { "0" }
$localBuildVal = if ($LocalBuild) { "1" } else { "0" }

$remoteCmds = @'
mkdir -p REMOTE_PATH
cd REMOTE_PATH

# A. Descomprimir el código fuente de finanzas
if [ -f ~/finanzas_lite.tar.gz ]; then
    echo '[+] Extrayendo codigo de finanzas en el servidor...'
    tar -xzf ~/finanzas_lite.tar.gz --warning=no-unknown-keyword -C .
    rm -f ~/finanzas_lite.tar.gz
fi

# B. Si se subió la compilación local, cargar la imagen
LOADED_LOCAL_BUILD=0
if [ "LOCAL_BUILD_VAL" -eq 1 ] && [ -f ~/finanzas_app.tar.gz ]; then
    echo '[+] Descomprimiendo imagen cargada...'
    tar -xzf ~/finanzas_app.tar.gz -C ~/
    echo '[+] Cargando imagen compilada localmente en Docker...'
    docker load < ~/finanzas_app.tar
    rm -f ~/finanzas_app.tar ~/finanzas_app.tar.gz
    echo '[+] Asegurando tags de imagen para compose (portal_hub-finanzas_app)...'
    docker tag portal-finanzas_app:latest portal_hub-finanzas_app:latest 2>/dev/null || true
    docker tag finanzas_app:latest portal_hub-finanzas_app:latest 2>/dev/null || true
    LOADED_LOCAL_BUILD=1
fi

# C. Configurar el archivo .env remoto para finanzas
if [ -d finanzas ]; then
    echo 'DATABASE_URL=mysql://hedkzmww_admin:sgsGRrR$o2@server.001webhospedaje.com:3306/hedkzmww_finanzas' > finanzas/.env
    echo "NEXTAUTH_URL=http://localhost/finanzas" >> finanzas/.env
    echo "NEXTAUTH_SECRET=y0ur_v3ry_s3cr3t_n3xt_4uth_k3y" >> finanzas/.env
    echo "GROQ_API_KEY=GROQ_KEY_VAL" >> finanzas/.env
fi

# D. Reconstruir si no se cargó localmente
NEEDS_BUILD=0
if [ "$LOADED_LOCAL_BUILD" -eq 0 ]; then
    NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
    echo '[+] Compilando aplicacion de finanzas en el servidor...'
    sudo docker compose build finanzas_app
fi

echo '[+] Reiniciando únicamente el contenedor finanzas_app...'
sudo docker compose up -d finanzas_app

# E. Limpieza de imágenes huérfanas
if [ "$LOADED_LOCAL_BUILD" -eq 1 ] || [ "$NEEDS_BUILD" -eq 1 ]; then
    echo '[+] Limpiando imagenes antiguas de Docker...'
    sudo docker image prune -f
fi
'@

# Reemplazar placeholders en el script bash remoto
$remoteCmds = $remoteCmds.Replace("REMOTE_PATH", $remotePath).Replace("LOCAL_BUILD_VAL", $localBuildVal).Replace("GROQ_KEY_VAL", $groqKey)

$localTempFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($localTempFile, ($remoteCmds.Replace("`r", "") + "`n"))
scp -i "$sshKey" -o StrictHostKeyChecking=no $localTempFile "${userAtHost}:~/deploy_finanzas_temp.sh"
ssh -i "$sshKey" -o StrictHostKeyChecking=no $userAtHost "bash ~/deploy_finanzas_temp.sh; rm -f ~/deploy_finanzas_temp.sh"
Remove-Item $localTempFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[V] Contenedor finanzas_app actualizado exitosamente." -ForegroundColor Green
} else {
    Write-Host "`n[X] Error durante la actualización de finanzas_app." -ForegroundColor Red
}
