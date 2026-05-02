# deploy_local.ps1
# Script para estabilizar y desplegar el entorno local de Zen Portal

Write-Host "─── ESTABILIZANDO ENTORNO LOCAL ───" -ForegroundColor Cyan

# 1. Limpieza de contenedores previos para evitar conflictos de nombres o puertos
Write-Host "[+] Limpiando contenedores previos..." -ForegroundColor Yellow
$containers = "smarttrack_db_prod", "smarttrack_backend_prod", "smarttrack_frontend_prod", "smarttrack_telegram_bot_prod", "smarttrack_redis_prod", "finanzas_app", "zen_portal"
foreach ($c in $containers) {
    docker rm -f $c 2>$null
}

# 2. Levantar stack con docker compose
Write-Host "[+] Levantando servicios con Docker Compose..." -ForegroundColor Yellow
# Usamos --remove-orphans para limpiar cualquier residuo
docker compose down --remove-orphans
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Error al levantar Docker Compose. Asegúrate de que Docker Desktop esté corriendo." -ForegroundColor Red
    exit
}

# 3. Esperar a que la base de datos esté lista
Write-Host "[+] Esperando a que MySQL esté saludable..." -ForegroundColor Yellow
$timeout = 30
$counter = 0
do {
    $status = docker inspect --format='{{json .State.Health.Status}}' smarttrack_db_prod 2>$null
    if ($status -eq '"healthy"') { break }
    Start-Sleep -Seconds 2
    $counter += 2
    if ($counter -gt $timeout) {
        Write-Host "[X] Tiempo de espera agotado para la base de datos." -ForegroundColor Red
        exit
    }
} while ($true)

# 4. Sincronizar Base de Datos (Prisma)
Write-Host "[+] Sincronizando esquema de base de datos..." -ForegroundColor Yellow
docker exec finanzas_app npx prisma db push --accept-data-loss

# 5. Poblar datos (Seed)
Write-Host "[+] Poblando datos iniciales y categorías..." -ForegroundColor Yellow
docker exec finanzas_app npx prisma db seed

Write-Host "`n[V] ENTORNO LOCAL DESPLEGADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "Portal: http://localhost/" -ForegroundColor Gray
Write-Host "Finanzas (App): http://localhost/finanzas" -ForegroundColor Gray
Write-Host "Adminer (DB UI): http://localhost:8080 - (Solo si esta habilitado)" -ForegroundColor Gray
