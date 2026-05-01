# Script para automatizar el commit y push a GitHub

Write-Host "[*] Iniciando actualizacion de GitHub..." -ForegroundColor Cyan

# 1. Solicitar el mensaje del commit
$commitMessage = Read-Host ">>> Ingresa el mensaje para el commit"

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    Write-Host "[!] Error: El mensaje del commit no puede estar vacio." -ForegroundColor Red
    exit
}

# 2. Agregar todos los cambios
Write-Host "[+] Agregando cambios..." -ForegroundColor Yellow
git add -A

# 3. Realizar el commit
Write-Host "[+] Creando commit..." -ForegroundColor Yellow
git commit -m "$commitMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[?] No hay cambios pendientes o el comando fallo." -ForegroundColor Gray
}

# 4. Enviar a GitHub
Write-Host "[+] Subiendo a la rama main..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "[V] GitHub actualizado exitosamente." -ForegroundColor Green
} else {
    Write-Host "[X] Error al intentar subir a GitHub." -ForegroundColor Red
}
