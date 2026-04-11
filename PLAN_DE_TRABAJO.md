# 📋 Plan de Trabajo — SmartTrack MVP
**Para:** Becario / Desarrollador Junior
**Proyecto:** [rcarcamoc/gestor_proyectos](https://github.com/rcarcamoc/gestor_proyectos)
**Stack:** FastAPI + React 19 + MySQL 8.4 + Docker
**Regla de oro:** Nunca hardcodear valores. Todo configurable desde `.env` o `system_config` en BD.

---

## ⚠️ Regla de pruebas obligatoria

Ningún hito se marca como ✅ si solo funciona en `localhost`. Debe verificarse en el servidor de Oracle.

| Entorno | URL | Cuándo usarlo |
|---|---|---|
| Desarrollo | `http://localhost:5173` | Mientras desarrollas |
| **Pruebas** | **`http://161.153.219.141`** | **Para marcar hito como completado** |
| Swagger API staging | `http://161.153.219.141:8000/docs` | Verificar endpoints en producción |

---

## 🔵 FASE 0 — Preparación del entorno
**Objetivo:** Que puedas correr el proyecto en tu máquina antes de tocar código.
**Tiempo estimado:** 2–4 horas

### Hito 0.1 — Setup local
- [ ] Instalar Docker Desktop y verificar que corre con `docker --version`
- [ ] Clonar el repositorio: `git clone https://github.com/rcarcamoc/gestor_proyectos.git`
- [ ] Copiar `.env.example` → `.env` en la raíz del proyecto
- [ ] Ejecutar `docker compose up --build` y esperar que todos los servicios suban sin error
- [ ] Verificar que `http://localhost:5173` muestra el frontend
- [ ] Verificar que `http://localhost:8000/health` responde `{"status": "ok"}`
- [ ] Verificar que `http://localhost:8080` muestra Adminer
- [ ] Ejecutar `docker compose exec backend alembic upgrade head`
- [ ] Ejecutar `docker compose exec backend python app/seed.py`
- [ ] **✅ Criterio:** Todos los servicios corren y la BD tiene tablas con datos seed

### Hito 0.2 — Familiarización con el código
- [ ] Leer completo el archivo `requerimiento inicial.md` en la raíz del repo
- [ ] Leer `README.md`
- [ ] Abrir `http://localhost:8000/docs` y revisar todos los endpoints disponibles en Swagger
- [ ] Revisar carpeta `backend/app/routers/` — hay 11 archivos; leer cada uno brevemente
- [ ] Revisar carpeta `backend/app/models/` para entender el modelo de datos actual
- [ ] Revisar carpeta `frontend/src/` para entender la estructura de componentes
- [ ] **✅ Criterio:** Puedes explicar en 2 minutos qué hace cada router

---

## 🔴 FASE 1 — Validación y corrección de lo que ya existe
**Objetivo:** Asegurarte de que todo lo que el requerimiento dice que debe existir, realmente funciona correctamente.
**Tiempo estimado:** 1 semana

### Hito 1.1 — Verificar autenticación JWT
- [ ] Probar `POST /auth/register` desde Swagger: crear usuario y organización
- [ ] Probar `POST /auth/login`: verificar que devuelve `access_token` + `refresh_token`
- [ ] Probar `POST /auth/refresh`: verificar que rota el token correctamente
- [ ] Probar `POST /auth/logout`: verificar que revoca el refresh token
- [ ] Intentar acceder a endpoint protegido sin token → debe devolver `HTTP 401`
- [ ] Verificar en Adminer que las contraseñas en tabla `users` están hasheadas (no texto plano)
- [ ] Verificar que el JWT contiene claims: `user_id`, `organization_id`, `role`, `exp`
- [ ] Crear dos usuarios en organizaciones diferentes y verificar que usuario A no puede ver datos de usuario B
- [ ] **✅ Criterio:** Los 4 endpoints de auth funcionan, contraseñas hasheadas, aislamiento multi-tenant verificado

### Hito 1.2 — Verificar modelo de datos
- [ ] Abrir Adminer y verificar que existen TODAS las tablas del requerimiento
- [ ] Tablas obligatorias: `organizations`, `teams`, `users`, `team_memberships`, `team_invitations`, `projects`, `tasks`, `task_assignments`, `task_dependencies`, `skills`, `user_skills`, `user_availability`, `holidays`, `absences`, `time_entries`, `task_metrics`, `emergency_plans`, `emergency_snapshots`, `emergency_action_logs`, `audit_logs`, `system_config`
- [ ] Verificar que tabla `system_config` tiene los 4 registros:
  - `engine_basic_hours_per_day = 8`
  - `engine_degraded_hours_per_day = 6`
  - `engine_default_task_hours = 4`
  - `emergency_rollback_window_hours = 2`
- [ ] Verificar que tabla `skills` tiene mínimo 20 registros del seed
- [ ] Verificar que tabla `holidays` tiene feriados de Chile para 2026
- [ ] **✅ Criterio:** Todas las tablas existen con los datos seed cargados

### Hito 1.3 — Verificar onboarding de 5 pasos
- [ ] Ir a `http://localhost:5173/register` y crear una cuenta nueva
- [ ] Completar Paso 1: ingresar nombre de organización, país Chile, nombre de equipo
- [ ] Paso 2: intentar skip (debe continuar sin errores)
- [ ] Paso 3: intentar skip → la UI debe mostrar mensaje informando que el motor operará en modo BASIC
- [ ] Paso 4: crear primer proyecto con nombre y prioridad (deadline opcional)
- [ ] Paso 5: crear primera tarea → el resultado debe mostrar la respuesta del motor con `motor_confidence` visible
- [ ] Verificar que la barra de progreso (1/5, 2/5, etc.) es visible en todo momento
- [ ] Cerrar sesión y volver a login → el sistema debe recordar que el onboarding ya está completo y llevar al dashboard
- [ ] **✅ Criterio:** Flujo completo de 5 pasos sin errores, motor_confidence visible en paso 5

### Hito 1.4 — Verificar CRUD de proyectos y tareas
- [ ] Crear proyecto con todos los campos completos → verificar que se guarda
- [ ] Crear proyecto sin deadline → no debe generar error
- [ ] Crear tarea sin `estimated_hours` y sin `start_date` → no debe generar error
- [ ] Cambiar estado de una tarea → verificar que `task_metrics` se actualiza en Adminer
- [ ] Intentar crear un proyecto como miembro (no líder) → debe devolver `HTTP 403`
- [ ] **✅ Criterio:** CRUD completo sin errores, permisos por rol funcionando

### Hito 1.5 — Verificar time tracking
- [ ] Iniciar timer en una tarea
- [ ] Intentar iniciar otro timer con uno ya activo → debe devolver `HTTP 409`
- [ ] Detener timer → verificar que `time_entry` se guardó en Adminer con duración correcta
- [ ] Registrar tiempo manualmente en otra tarea
- [ ] Verificar que horas acumuladas son visibles en la vista de tarea
- [ ] **✅ Criterio:** Timer funciona, no permite doble timer, horas acumuladas correctas

### Hito 1.6 — Verificar modo emergencia
- [ ] Acceder como líder al dashboard
- [ ] Encontrar botón de "Modo emergencia" (debe existir, no ser prominente)
- [ ] Ejecutar preview → debe mostrar cambios propuestos sin aplicarlos
- [ ] Aplicar el plan → verificar que se crea snapshot en tabla `emergency_snapshots` en Adminer
- [ ] Ejecutar rollback dentro de 2h → verificar que el estado regresa
- [ ] Intentar rollback después de 2h (cambiar el valor en `system_config` para simular) → debe devolver error claro
- [ ] **✅ Criterio:** Preview + apply + rollback funciona, snapshot guardado en BD

---

## 🟠 FASE 2 — Funcionalidades faltantes críticas
**Objetivo:** Implementar las brechas identificadas que son bloqueantes para el diferenciador del producto.
**Tiempo estimado:** 2–3 semanas

### Hito 2.1 — Vista global multi-proyecto ⚠️ DIFERENCIADOR PRINCIPAL
**¿Por qué?** Este es el corazón de lo que hace especial a SmartTrack. Sin esto, es un gestor de proyectos normal.

**Backend:**
- [ ] Crear endpoint `GET /dashboard/capacity` que retorne para cada miembro del equipo:
  - Nombre
  - Lista de proyectos en los que participa actualmente
  - Horas comprometidas total (suma de `estimated_hours` de tareas activas en TODOS sus proyectos)
  - Horas disponibles según su `user_availability`
  - Porcentaje de carga: `(horas_comprometidas / horas_disponibles) * 100`
  - Estado: `LIBRE` (<50%), `NORMAL` (50–80%), `CARGADO` (80–95%), `SOBRECARGADO` (>95%)
- [ ] Crear endpoint `POST /engine/check-cross-project-impact` que reciba `task_id` y `user_id` y retorne lista de tareas en OTROS proyectos que se verían afectadas

**Frontend:**
- [ ] Crear vista `/dashboard/capacity` (solo visible para líderes)
- [ ] Mostrar tarjetas de cada miembro con barra de progreso de carga
- [ ] Código de color: verde (libre), amarillo (cargado), rojo (sobrecargado)
- [ ] Al hacer click en una tarjeta, mostrar detalle de proyectos y tareas activas de esa persona
- [ ] **✅ Criterio:** El líder puede ver de un vistazo quién está disponible y en qué proyectos

### Hito 2.2 — Alerta inteligente de impacto cross-proyecto
**¿Por qué?** Es la funcionalidad que distingue SmartTrack de cualquier otro gestor.

**Backend:**
- [ ] En `POST /tasks`, ANTES de guardar, verificar impacto cross-proyecto del asignado
- [ ] Retornar objeto `cross_project_warning` junto al resultado:
  ```json
  {
    "cross_project_warning": {
      "has_impact": true,
      "affected_projects": ["Proyecto A", "Proyecto B"],
      "affected_tasks": [],
      "recommendation": "Juan tiene 95% de carga. Considera asignar a María (60% carga, skills match 80%)"
    }
  }
  ```
- [ ] En `PATCH /tasks/:id` al cambiar asignado o fechas, también disparar esta verificación

**Frontend:**
- [ ] Al seleccionar un asignado en el formulario de tarea, mostrar su porcentaje de carga actual en tiempo real
- [ ] Si hay impacto cross-proyecto, mostrar **modal de advertencia** ANTES de confirmar con: proyectos afectados, tareas en riesgo y sugerencia de reasignación
- [ ] El modal debe tener 3 opciones: "Asignar de todas formas", "Ver alternativas", "Cancelar"
- [ ] **✅ Criterio:** Al asignar tarea a persona sobrecargada, aparece advertencia con impacto real y alternativas

### Hito 2.3 — Sugerencia automática de asignado por skills + disponibilidad
**Backend:**
- [ ] Mejorar endpoint `POST /engine/suggest-assignee` para retornar lista rankeada con:
  - `match_percentage`: qué tan bien encajan los skills requeridos
  - `availability_percentage`: cuánta carga libre tiene esta semana
  - `score_total`: promedio ponderado (70% skills, 30% disponibilidad)
  - `justification`: texto legible "Tiene Python (avanzado) y 6h libres esta semana"
- [ ] Ordenar candidatos de mayor a menor `score_total`
- [ ] Si no hay skills en la tarea, rankear solo por disponibilidad e indicar que es estimado

**Frontend:**
- [ ] En el formulario de tarea, campo "Asignado" debe tener botón "Sugerir"
- [ ] Al hacer click, mostrar panel lateral con lista rankeada de candidatos
- [ ] Cada candidato muestra: nombre, score de match, horas disponibles, badge de nivel de confianza
- [ ] Click en candidato lo selecciona en el formulario
- [ ] **✅ Criterio:** El sistema sugiere personas ordenadas por idoneidad real

### Hito 2.4 — Tests unitarios (obligatorios)
- [ ] Instalar `pytest` y `httpx` en `backend/requirements.txt`
- [ ] Crear carpeta `backend/tests/` con `conftest.py` usando SQLite en memoria para pruebas
- [ ] Tests del motor:
  - `test_motor_level_full()`: usuario con horario + skills + historial → nivel FULL
  - `test_motor_level_basic()`: usuario sin skills → nivel BASIC
  - `test_motor_level_degraded()`: usuario sin datos → nivel DEGRADED
  - `test_defaults_from_db()`: cambiar valor en BD y verificar que motor lo usa
- [ ] Tests de autenticación:
  - `test_register_creates_user_and_org()`
  - `test_login_returns_jwt()`
  - `test_protected_endpoint_without_token_returns_401()`
  - `test_cross_tenant_access_returns_403()`
- [ ] Tests de time tracking:
  - `test_double_timer_returns_409()`
  - `test_stop_timer_saves_duration()`
- [ ] **✅ Criterio:** `pytest` corre sin errores, mínimo 10 tests pasando

---

## 🟡 FASE 3 — Mejoras de producto y UX
**Objetivo:** Hacer que el producto se vea y sienta profesional.
**Tiempo estimado:** 1–2 semanas

### Hito 3.1 — Notificaciones in-app
- [ ] Crear tabla `notifications`: `id`, `user_id`, `type`, `message`, `is_read`, `created_at`, `metadata JSON`
- [ ] Crear endpoint `GET /notifications` (no leídas primero)
- [ ] Crear endpoint `PATCH /notifications/:id/read`
- [ ] Disparar notificación automáticamente cuando:
  - Una tarea te es asignada
  - Una tarea tuya se acerca a su deadline (1 día antes)
  - El motor detecta un conflicto que te afecta
  - Se ejecuta un modo emergencia en tu equipo
- [ ] Agregar campana de notificaciones en el header con badge de no leídas
- [ ] **✅ Criterio:** Cuando se asigna una tarea, aparece notificación en la campana

### Hito 3.2 — Vista de calendario de carga
- [ ] Instalar librería de calendario en frontend (recomendado: `@fullcalendar/react`)
- [ ] Crear vista `/calendar` con tareas del usuario por semana basado en `start_date` y `deadline`
- [ ] Marcar feriados de Chile en el calendario
- [ ] Código de color por prioridad: rojo = crítica, naranja = alta, azul = media, gris = baja
- [ ] Para líderes: vista del equipo completo con filtro por persona
- [ ] **✅ Criterio:** El usuario puede ver sus tareas distribuidas en el calendario

### Hito 3.3 — Estados vacíos y estados de carga
- [ ] Revisar cada vista del frontend y verificar qué pasa cuando no hay datos
- [ ] Implementar estado vacío en: lista de proyectos, lista de tareas, dashboard miembro sin tareas, dashboard líder sin alertas
- [ ] Cada estado vacío debe tener: ícono ilustrativo, mensaje útil y botón de acción principal
- [ ] Implementar skeleton loaders en todas las listas mientras cargan datos
- [ ] **✅ Criterio:** Ninguna vista muestra pantalla en blanco

### Hito 3.4 — Búsqueda global
- [ ] Crear endpoint `GET /search?q=texto` que busque en: proyectos, tareas y miembros del equipo
- [ ] Retornar resultados agrupados por tipo, máximo 5 por categoría
- [ ] Agregar barra de búsqueda en el header con atajo `Cmd/Ctrl + K`
- [ ] Mostrar resultados en dropdown con navegación por teclado (↑↓ + Enter)
- [ ] **✅ Criterio:** Resultados aparecen en menos de 500ms

### Hito 3.5 — Onboarding de miembro
- [ ] Crear flujo de aceptación de invitación: `GET /invitations/:token/accept`
- [ ] Pantalla de: verificar nombre, elegir contraseña, configurar skills, configurar disponibilidad horaria
- [ ] Después del onboarding de miembro, llevar directamente al dashboard de miembro
- [ ] **✅ Criterio:** Un miembro puede aceptar invitación y configurar su perfil en menos de 5 minutos

---

## 🟢 FASE 4 — CI/CD y Deploy
**Objetivo:** Automatizar que el código subido al repo se despliega correctamente a Oracle.
**Tiempo estimado:** 3–5 días

### Hito 4.1 — GitHub Actions pipeline
- [ ] Crear archivo `.github/workflows/ci.yml`
- [ ] El pipeline se ejecuta en cada `push` a `main`
- [ ] **Paso 1 — CI (tests):**
  1. Checkout del código
  2. Levantar MySQL 8.4 como servicio de GitHub Actions
  3. Instalar dependencias: `pip install -r requirements.txt`
  4. Ejecutar migraciones: `alembic upgrade head`
  5. Ejecutar tests: `pytest`
  6. Build del frontend: `npm run build`
- [ ] **Paso 2 — Deploy a Oracle (solo si los tests pasan):**
  1. Conectar por SSH a `161.153.219.141` usando secret de GitHub (`ORACLE_SSH_KEY`)
  2. Ejecutar el script de actualización en el servidor
  3. Verificar que el servicio quedó levantado
- [ ] Agregar los siguientes **GitHub Secrets** en el repo (Settings → Secrets → Actions):
  - `ORACLE_HOST` = `161.153.219.141`
  - `ORACLE_USER` = usuario SSH del servidor
  - `ORACLE_SSH_KEY` = llave privada SSH
  - `JWT_SECRET`, `DB_PASSWORD` y demás variables del `.env`
- [ ] **✅ Criterio:** Push a `main` → tests pasan → deploy automático → app en `http://161.153.219.141`

### Hito 4.2 — Deploy manual a Oracle
Para cuando necesites hacer deploy sin esperar el pipeline:

- [ ] El script de deploy está en tu máquina en:
  ```
  C:\Users\arant\OneDrive\Desarrollo\Gestor proyectos\update_oracle.ps1
  ```
- [ ] Abrir PowerShell y ejecutar:
  ```powershell
  cd "C:\Users\arant\OneDrive\Desarrollo\Gestor proyectos"
  .\update_oracle.ps1
  ```
- [ ] Esperar que el script termine sin errores
- [ ] Verificar abriendo `http://161.153.219.141` en el navegador
- [ ] **✅ Criterio:** La app responde correctamente en `http://161.153.219.141`

### Hito 4.3 — Pre-commit hooks
- [ ] Instalar `pre-commit` en el proyecto
- [ ] Configurar `.pre-commit-config.yaml` con:
  - `black` para formateo Python
  - `flake8` para linting Python
  - `eslint` para TypeScript
- [ ] Verificar que commit con código mal formateado es rechazado
- [ ] **✅ Criterio:** No se puede hacer commit con código que no pase el linting

---

## 📊 Resumen de Fases

| Fase | Descripción | Tiempo estimado |
|---|---|---|
| 0 | Setup y familiarización | 2–4 horas |
| 1 | Validación de lo existente | 1 semana |
| 2 | Funcionalidades críticas faltantes | 2–3 semanas |
| 3 | Mejoras UX y producto | 1–2 semanas |
| 4 | CI/CD y Deploy | 3–5 días |

---

## 📌 Reglas de trabajo que debes seguir siempre

1. **Nunca hardcodear** valores del motor. Siempre leer desde `system_config` en BD
2. **Nunca saltar la revisión cross-tenant**: toda query debe filtrar por `organization_id`
3. **Cada funcionalidad nueva** necesita al menos un test antes de hacer merge
4. **El motor nunca bloquea**: siempre degrada con advertencia, nunca lanza error 500
5. **Antes de marcar un hito como ✅**, verificar en `http://161.153.219.141`, no solo en local
6. **Antes de hacer push**, verificar que `docker compose up --build` sigue funcionando desde cero
7. **Documenta cada decisión** técnica en la sección "Registro de decisiones técnicas" del `requerimiento inicial.md`
