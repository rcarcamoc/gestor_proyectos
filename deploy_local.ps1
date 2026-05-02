# deploy_local.ps1
# Script para estabilizar y desplegar el entorno local de Zen Portal

Write-Host "─── ESTABILIZANDO ENTORNO LOCAL ───" -ForegroundColor Cyan

# 1. Limpieza de contenedores huérfanos o conflictivos
Write-Host "[+] Limpiando contenedores previos..." -ForegroundColor Yellow
docker rm -f smarttrack_db smarttrack_backend smarttrack_frontend smarttrack_adminer finanzas_app zen_portal 2>$null

# 2. Levantar stack con docker compose
Write-Host "[+] Levantando servicios con Docker Compose..." -ForegroundColor Yellow
docker compose down
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Error al levantar Docker Compose." -ForegroundColor Red
    exit
}

# 3. Esperar a que la base de datos esté lista
Write-Host "[+] Esperando a que MySQL esté saludable..." -ForegroundColor Yellow
do {
    $status = docker inspect --format='{{json .State.Health.Status}}' smarttrack_db_prod
    Start-Sleep -Seconds 2
} while ($status -ne '"healthy"')

# 4. Sincronizar Base de Datos (Prisma)
Write-Host "[+] Sincronizando esquema de base de datos..." -ForegroundColor Yellow
docker exec finanzas_app npx prisma db push --accept-data-loss

# 5. Poblar datos (Seed)
Write-Host "[+] Poblando datos iniciales (Categorías, Usuarios)..." -ForegroundColor Yellow
docker exec finanzas_app npx prisma db seed

Write-Host "`n[V] ENTORNO LOCAL DESPLEGADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "Portal: http://localhost/" -ForegroundColor Gray
Write-Host "Finanzas: http://localhost/finanzas/" -ForegroundColor Gray
