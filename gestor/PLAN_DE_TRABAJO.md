# Requerimiento de Mejoras y Corrección de Bugs
## Sistema: Gestor de Proyectos (`gestor_proyectos`)
**Versión analizada:** commit `ad85673`  
**Fecha:** 26 de abril de 2026  
**Solicitado por:** Ricardo Cárcamo  
**Prioridad de entrega:** A definir con el equipo

---

## Contexto

Este documento consolida los hallazgos de una revisión funcional completa del frontend del sistema Gestor de Proyectos, realizada desde la perspectiva de un usuario PM. Se identificaron bugs críticos, inconsistencias de UX y funcionalidades faltantes que impiden el uso fluido del sistema en un entorno productivo.

Los archivos analizados comprenden todas las páginas del frontend: `TaskList.tsx`, `Dashboard.tsx`, `ProjectList.tsx`, `EmergencyMode.tsx`, `CapacityDashboard.tsx`, `App.tsx` y componentes asociados.

---

## SECCIÓN 1 — Bugs Críticos (Prioridad P0)

Estos problemas afectan funcionalidades core y deben corregirse antes de cualquier nuevo desarrollo.

---

### BUG-01 — Completar una tarea no es intuitivo ni accesible

**Archivo:** `frontend/src/pages/tasks/TaskList.tsx`  
**Severidad:** Crítica  
**Descripción:**  
El único mecanismo para marcar una tarea como "Completada" desde la lista es un cuadrado personalizado de 20×20px (`w-5 h-5`) ubicado a la izquierda del nombre, sin etiqueta ni tooltip. El comportamiento es un toggle oculto: si la tarea está `Completed`, vuelve a `Pending`. No existe ningún botón explícito con el texto "Completar" o "Cerrar tarea".

Dentro del modal de detalle de tarea, tampoco existe un botón para completarla. La única opción está escondida en "Editar Detalles / Fechas", donde el usuario debe abrir un segundo modal y cambiar manualmente el campo `Status` en un `<select>` con 7 opciones.

**Comportamiento actual:**
- Checkbox de 20px sin texto ni tooltip → toggle Pending/Completed
- En detalle: botón prominente "Mark as Critical (Emergency)" es lo primero visible
- Para completar desde detalle: 3 clics mínimos (Abrir detalle → Editar → Cambiar select)

**Comportamiento esperado:**
- Botón explícito "Completar tarea" visible en la fila de la tabla (columna Acciones)
- Botón "Completar tarea" en el modal de detalle, con estado visual claro (verde, ícono de check)
- El checkbox pequeño puede permanecer como acceso rápido, pero debe tener un `title` o tooltip

**Solución sugerida:**
```tsx
// En la columna de Acciones de la tabla:
<button
  onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'Completed'); }}
  className="text-accent-green hover:underline text-xs mr-2"
  title="Marcar como completada"
>
  ✓ Completar
</button>

// En el modal de detalle:
<button
  onClick={() => updateTaskStatus(currentTask.id, 'Completed')}
  className="w-full bg-accent-green text-white text-xs font-bold py-2 rounded-lg"
>
  ✓ Marcar como Completada
</button>
```

---

### BUG-02 — Checkboxes del Dashboard no actualizan el estado en base de datos

**Archivo:** `frontend/src/pages/Dashboard.tsx`  
**Severidad:** Crítica  
**Descripción:**  
En la sección "Tareas para hoy" del Dashboard, cada tarea muestra un `<input type="checkbox">` que visualmente aparenta permitir marcar la tarea como completada. Sin embargo, el elemento no tiene ningún handler `onChange` ni llama a ninguna función de la API.

El usuario puede marcar el checkbox, ver el tick, y al recargar la página la tarea sigue en estado `Pending` en la base de datos. Es un comportamiento engañoso (false feedback).

**Código actual:**
```tsx
<input type="checkbox" className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500" />
```

**Comportamiento esperado:**
- Al marcar el checkbox, debe llamar a `PATCH /tasks/{id}` con `{ status: "Completed" }`
- La tarea debe desaparecer del listado de "tareas para hoy" o mostrar un estado tachado

**Solución sugerida:**
```tsx
<input
  type="checkbox"
  checked={t.status === 'Completed'}
  onChange={() => handleToggleTask(t.id, t.status)}
  className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
/>
```
Donde `handleToggleTask` llama al endpoint `PATCH /tasks/{id}` y actualiza el estado local.

---

### BUG-03 — Filtro "ActionNeeded" en tareas no funciona correctamente

**Archivo:** `frontend/src/pages/tasks/TaskList.tsx`, función `filteredTasks`  
**Severidad:** Alta  
**Descripción:**  
El filtro `ActionNeeded` está implementado de forma incompleta. Solo muestra tareas con status `Blocked`, ignorando tareas vencidas (overdue). El propio código tiene un comentario que lo reconoce:

```tsx
// Dummy simplification: Only show Blocked or Overdue (we approximate overdue here or just rely on status)
if (task.status !== "Blocked") return false;
```

**Comportamiento esperado:**
- Mostrar tareas con `status === "Blocked"` O tareas cuya `deadline` sea anterior a la fecha actual y no estén completadas

**Solución sugerida:**
```tsx
if (filter === "ActionNeeded") {
  const isBlocked = task.status === "Blocked";
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "Completed";
  if (!isBlocked && !isOverdue) return false;
}
```

---

### BUG-04 — Campo de búsqueda de tareas hardcodeado como string vacío

**Archivo:** `frontend/src/pages/tasks/TaskList.tsx`  
**Severidad:** Alta  
**Descripción:**  
La variable `searchQuery` está declarada como una constante vacía con comentario explícito de que está hardcodeada:

```tsx
const searchQuery = ""; // hardcoded for now since no input changes it in current scope
```

No existe ningún campo `<input>` de búsqueda en la UI, por lo que la funcionalidad de filtrar tareas por texto nunca opera. La lógica de filtrado por texto existe pero es inaccesible.

**Solución esperada:**
- Agregar un campo de texto en el header de la página de tareas conectado a un estado `searchQuery`
- Alternativamente, si se decide remover la funcionalidad, eliminar también la lógica de filtrado por texto para no confundir futuros mantenedores

---

### BUG-05 — Atajos rápidos del Dashboard sin implementar

**Archivo:** `frontend/src/pages/Dashboard.tsx`, sección "Atajos rápidos"  
**Severidad:** Media  
**Descripción:**  
El sidebar del Dashboard muestra tres botones de acción rápida que no tienen ningún handler definido:

- "Registrar tiempo manual"
- "Solicitar ausencia"
- "Actualizar mis skills"

Los tres son botones `<button>` sin `onClick`. Deben implementarse o eliminarse de la UI hasta que estén listos para evitar generar expectativas incorrectas al usuario.

---

### BUG-06 — Botón "Sugerir" en modal de creación de tarea vacío

**Archivo:** `frontend/src/pages/tasks/TaskList.tsx`, sección `isModalOpen`  
**Severidad:** Media  
**Descripción:**  
El botón "Sugerir" junto al campo Assignee tiene el siguiente handler:

```tsx
onClick={() => {/* Trigger suggestion panel here if desired */}}
```

No hace nada. El motor de sugerencias de asignees solo funciona al abrir el detalle de una tarea **ya existente**, no durante la creación.

**Solución esperada:**
- Conectar el botón a `getSuggestions()` al momento de crear la tarea, usando el `project_id` y las horas estimadas ya ingresadas en el formulario
- Mostrar las sugerencias debajo del select de Assignee dentro del mismo modal

---

## SECCIÓN 2 — Bugs de UX (Prioridad P1)

Problemas que no rompen funcionalidad pero generan confusión operacional.

---

### UX-01 — Mezcla de idiomas español/inglés sin consistencia

**Archivos:** `TaskList.tsx`, `Dashboard.tsx`, `ProjectList.tsx`, múltiples componentes  
**Descripción:**  
El sistema alterna entre español e inglés de forma aleatoria dentro de la misma pantalla, lo que genera confusión especialmente en los estados de las tareas:

- El `<select>` de status en el formulario muestra valores en español: "Pendiente", "En Curso", "Completada"
- La tabla muestra los mismos valores tal como están en la BD: "Pending", "In Progress", "Completed"
- El filtro de tareas compara strings en inglés (`filter === "Completed"`) pero la etiqueta del botón podría estar en español

**Solución esperada:**
- Definir un idioma base consistente para toda la UI (se recomienda español dado el mercado objetivo)
- Crear un mapa de traducción de estados:
```tsx
const STATUS_LABELS: Record<string, string> = {
  "Pending": "Pendiente",
  "In Progress": "En Curso",
  "Completed": "Completada",
  "Blocked": "Bloqueada",
  "Scheduled": "Programada",
  "Pending Response Op": "Pdte. Respuesta Operación",
  "Pending Response Client": "Pdte. Respuesta Cliente",
};
```
- Usar `STATUS_LABELS[task.status] ?? task.status` en todos los lugares donde se muestra el estado

---

### UX-02 — Modo Emergencia pierde la barra de navegación

**Archivo:** `frontend/src/App.tsx`, ruta `/emergency`  
**Descripción:**  
La ruta `/emergency` no usa el componente `DashboardLayout`, por lo que el usuario pierde toda la navegación lateral al acceder a esa página. Si algo sale mal o quiere cancelar sin aplicar cambios, debe usar el botón "Atrás" del navegador. La única salida explícita aparece solo después de completar un rollback.

**Solución esperada:**
- Envolver `EmergencyMode` con `DashboardRoutes` en `App.tsx`:
```tsx
<Route path="/emergency" element={
  <DashboardRoutes>
    <EmergencyMode />
  </DashboardRoutes>
} />
```
- O agregar un botón "← Volver al Dashboard" en el header de la página de emergencia

---

### UX-03 — Menú de acciones de proyecto oculto e inconsistente

**Archivo:** `frontend/src/pages/projects/ProjectList.tsx`  
**Descripción:**  
Las acciones sobre un proyecto ("Ver Tareas", "Editar") están escondidas detrás de un ícono `···` (MoreHorizontal) sin ningún indicador visual de que es interactivo. El menú no tiene opción de cerrar, archivar ni eliminar un proyecto. Un usuario nuevo no descubrirá estas acciones sin explorar.

**Solución esperada:**
- Hacer visible el botón `···` siempre (no solo en hover)
- Agregar opción "Archivar / Cerrar proyecto" en el menú contextual
- Considerar mover "Ver Tareas" como link directo en la tarjeta del proyecto (click en el nombre del proyecto)

---

### UX-04 — Timer Widget del Dashboard no conectado a tarea específica

**Archivo:** `frontend/src/pages/Dashboard.tsx`  
**Descripción:**  
El `TimerWidget` en el sidebar siempre carga la primera tarea del día de forma hardcodeada:

```tsx
<TimerWidget taskId={data.tasks_today?.[0]?.id || 1} taskName={data.tasks_today?.[0]?.name || "Tarea demo"} />
```

No hay forma de iniciar el timer desde el detalle de una tarea específica. Los botones "Start Timer (API)" y "Stop" en el modal de detalle de tarea son puramente decorativos y no llaman a ninguna función.

**Solución esperada:**
- Los botones Start/Stop del modal de detalle deben llamar a los endpoints del TimerWidget
- El Timer en el sidebar debe actualizarse cuando se inicia desde el modal de detalle

---

### UX-05 — Capacity Dashboard sin acciones desde las tarjetas

**Archivo:** `frontend/src/pages/CapacityDashboard.tsx`  
**Descripción:**  
El dashboard muestra correctamente la carga de cada miembro (LIBRE / NORMAL / CARGADO / SOBRECARGADO), pero no ofrece ninguna acción. Cuando un miembro está SOBRECARGADO, el líder debe ir manualmente a `/tasks`, filtrar, abrir cada tarea y reasignarla.

**Solución esperada:**
- Agregar en cada tarjeta un botón o link "Ver tareas →" que lleve a `/tasks?assignee={id}`
- Considerar un acceso rápido a reasignación desde la tarjeta de miembro sobrecargado

---

## SECCIÓN 3 — Nuevas Funcionalidades (Backlog)

Funcionalidades estándar en sistemas de gestión de proyectos que actualmente no existen. Se presentan ordenadas por impacto vs. esfuerzo estimado.

---

### FEAT-01 — Vista Kanban de tareas

**Prioridad:** Alta  
**Impacto:** Alto | **Esfuerzo:** Medio  
**Descripción:**  
Actualmente la única vista de tareas es una tabla. Un Kanban (columnas por estado, arrastrar para cambiar estado) es la vista más utilizada en gestión ágil de tareas.

**Requerimiento:**
- Agregar toggle de vista (tabla / kanban) en el header de la página `/tasks`
- En vista Kanban, cada columna representa un estado: Pendiente → Programada → En Curso → Bloqueada → Completada
- Drag & drop entre columnas debe llamar a `PATCH /tasks/{id}` con el nuevo status
- El filtro por proyecto debe funcionar igual en ambas vistas

---

### FEAT-02 — Progreso calculado del proyecto

**Prioridad:** Alta  
**Impacto:** Alto | **Esfuerzo:** Bajo  
**Descripción:**  
Las tarjetas de proyecto no muestran ningún indicador de avance. El porcentaje debe calcularse automáticamente como `tareas completadas / tareas totales del proyecto`.

**Requerimiento:**
- Mostrar en cada tarjeta de proyecto: barra de progreso + "X de Y tareas completadas"
- El endpoint `GET /projects/` debe incluir `tasks_total` y `tasks_completed` en la respuesta, o agregar un campo calculado en el frontend al hacer el join con tareas

---

### FEAT-03 — Archivar/cerrar proyectos y tareas

**Prioridad:** Alta  
**Impacto:** Alto | **Esfuerzo:** Bajo  
**Descripción:**  
No existe flujo para dar por terminado un proyecto o archivarlo. Un PM necesita poder cerrar proyectos sin eliminarlos.

**Requerimiento:**
- Agregar estado `Archived` / `Closed` a proyectos
- Opción "Archivar proyecto" en el menú `···` de la tarjeta
- Los proyectos archivados deben ocultarse por defecto con un toggle "Mostrar archivados"
- El mismo concepto aplica a tareas completadas: opción de archivar para limpiar la vista

---

### FEAT-04 — Barra de búsqueda funcional en tareas

**Prioridad:** Alta  
**Impacto:** Medio | **Esfuerzo:** Bajo  
**Descripción:**  
La lógica de búsqueda por texto en `TaskList.tsx` ya existe en el código pero está deshabilitada (ver BUG-04). Solo requiere agregar el campo de input y conectarlo al estado.

**Requerimiento:**
- Input de búsqueda visible en el header de la página de tareas
- Filtrado en tiempo real por nombre de tarea (ya implementado en lógica, solo falta la UI)
- Bonus: buscar también en descripción y nombre del proyecto asignado

---

### FEAT-05 — Ordenamiento por columna en tabla de tareas

**Prioridad:** Media  
**Impacto:** Medio | **Esfuerzo:** Bajo  
**Descripción:**  
La tabla de tareas no permite ordenar por ninguna columna. Es una función básica esperada en cualquier tabla de datos.

**Requerimiento:**
- Los headers "Task Name", "Project", "Status" deben ser clickeables para ordenar
- Click primero: ascendente. Click segundo: descendente. Click tercero: sin orden.
- Mostrar indicador visual (flecha ↑↓) en la columna activa

---

### FEAT-06 — Perfil de skills editable por el usuario

**Prioridad:** Media  
**Impacto:** Alto | **Esfuerzo:** Medio  
**Descripción:**  
El motor de sugerencias de asignees funciona con base en skills, pero no existe una interfaz donde el usuario pueda ver o editar sus propias competencias. El atajo "Actualizar mis skills" en el Dashboard está vacío (ver BUG-05).

**Requerimiento:**
- Página `/settings` o sección en perfil de usuario con lista de skills del usuario
- Permitir agregar, editar y eliminar skills con nivel de competencia (básico / intermedio / avanzado)
- Conectar al endpoint que ya consume el motor de sugerencias

---

### FEAT-07 — Notificaciones in-app

**Prioridad:** Media  
**Impacto:** Alto | **Esfuerzo:** Alto  
**Descripción:**  
No existe ningún sistema de notificaciones en la interfaz. El usuario no recibe alertas de asignaciones, cambios de estado, comentarios ni tareas por vencer.

**Requerimiento mínimo (MVP):**
- Ícono de campana en el header con contador de notificaciones no leídas
- Al hacer click, panel lateral con listado de notificaciones recientes
- Tipos de notificación: tarea asignada, tarea vencida, comentario recibido, cambio de estado
- Marcar como leída al hacer click

**Requerimiento complementario:**
- Notificaciones push por Telegram (el bot ya existe, ampliar sus triggers)

---

### FEAT-08 — Filtros guardados en tareas

**Prioridad:** Media  
**Impacto:** Medio | **Esfuerzo:** Medio  
**Descripción:**  
Un PM trabaja frecuentemente con las mismas combinaciones de filtros (ej: "mis tareas en progreso del Proyecto X"). No existe forma de guardar estos filtros.

**Requerimiento:**
- Botón "Guardar filtro actual" cuando hay filtros activos
- Listado de filtros guardados en el sidebar o header de la página de tareas
- Los filtros se guardan por usuario (en BD o localStorage)

---

### FEAT-09 — Reporte de horas estimadas vs. reales

**Prioridad:** Media  
**Impacto:** Alto | **Esfuerzo:** Medio  
**Descripción:**  
El campo `actual_hours` existe en el modelo de tarea pero no se visualiza en ningún reporte. Esta información es fundamental para que el PM evalúe la precisión de las estimaciones.

**Requerimiento:**
- Sección de reportes en `/capacity` o nueva ruta `/reports`
- Tabla con columnas: Tarea, Proyecto, Asignado a, Horas Estimadas, Horas Reales, Diferencia
- Filtros por proyecto y por rango de fechas
- Totales por proyecto y por persona

---

### FEAT-10 — Dependencias entre tareas

**Prioridad:** Baja (pero estratégica)  
**Impacto:** Alto | **Esfuerzo:** Alto  
**Descripción:**  
No existe forma de indicar que una tarea depende de otra. En proyectos con múltiples fases esto es crítico para la planificación.

**Requerimiento:**
- Campo "Bloqueada por" en el formulario de tarea (selector de otra tarea del mismo proyecto)
- Una tarea con dependencia no puede pasar a "In Progress" si la tarea bloqueante no está completada
- Indicador visual en la tarjeta/fila de la tarea que muestre la dependencia

---

## SECCIÓN 4 — Mejoras de Deuda Técnica

Observaciones del código que afectan mantenibilidad futura.

---

### TECH-01 — Variables de estado con tipo `any` generalizado

**Descripción:** Gran parte de los estados en `TaskList.tsx` usan `any[]` o `any` como tipo TypeScript (`useState<any[]>`, `useState<any>(null)`). Esto elimina los beneficios de tipado estático y dificulta el mantenimiento.  
**Acción:** Definir interfaces o types para `Task`, `Project`, `TeamMember` y usarlos en todos los componentes.

---

### TECH-02 — Navegación con `window.location.href` en lugar de React Router

**Archivos:** `Dashboard.tsx`, `ProjectList.tsx`  
**Descripción:** Varias navegaciones usan `window.location.href = '/ruta'` en lugar de `useNavigate()` de React Router, lo que causa recargas completas de la página innecesarias.  
**Acción:** Reemplazar todos los `window.location.href` por `navigate('/ruta')` de `useNavigate`.

---

### TECH-03 — `fetchData` llama solo al primer equipo

**Archivo:** `frontend/src/pages/tasks/TaskList.tsx`  
**Descripción:** Los miembros del equipo se cargan únicamente para `teamRes.data[0].id` (el primer equipo encontrado). Si hay múltiples equipos, los miembros de los demás equipos no aparecen como opción al asignar tareas.  
**Acción:** Evaluar si la arquitectura soporta múltiples equipos y adaptar la carga en consecuencia.

---

## Resumen Ejecutivo de Prioridades

| ID | Tipo | Descripción corta | Prioridad | Esfuerzo estimado |
|----|------|-------------------|-----------|-------------------|
| BUG-01 | Bug P0 | Botón visible para completar tareas | Urgente | 2h |
| BUG-02 | Bug P0 | Checkboxes del Dashboard funcionales | Urgente | 1h |
| BUG-03 | Bug P0 | Filtro ActionNeeded incluye overdue | Urgente | 1h |
| BUG-04 | Bug P1 | Buscador de tareas con input real | Alta | 2h |
| BUG-05 | Bug P1 | Eliminar/implementar atajos rápidos | Media | 1h |
| BUG-06 | Bug P1 | Botón Sugerir asignee funcional | Media | 3h |
| UX-01 | UX | Unificar idioma en toda la UI | Alta | 3h |
| UX-02 | UX | Modo Emergencia con layout de navegación | Alta | 30min |
| UX-03 | UX | Menú de proyecto visible + archivar | Alta | 2h |
| UX-04 | UX | Timer conectado a tarea desde detalle | Media | 4h |
| UX-05 | UX | Acciones en Capacity desde tarjetas | Media | 2h |
| FEAT-01 | Feature | Vista Kanban de tareas | Alta | 2-3 días |
| FEAT-02 | Feature | Progreso calculado del proyecto | Alta | 4h |
| FEAT-03 | Feature | Archivar/cerrar proyectos | Alta | 4h |
| FEAT-04 | Feature | Búsqueda funcional (activar lógica) | Alta | 1h |
| FEAT-05 | Feature | Ordenamiento en tabla | Media | 3h |
| FEAT-06 | Feature | Perfil de skills editable | Media | 1 día |
| FEAT-07 | Feature | Notificaciones in-app | Media | 3-4 días |
| FEAT-08 | Feature | Filtros guardados | Media | 1 día |
| FEAT-09 | Feature | Reporte horas estimadas vs reales | Media | 1 día |
| FEAT-10 | Feature | Dependencias entre tareas | Baja | 3-4 días |
| TECH-01 | Deuda | Tipado TypeScript con interfaces | Baja | 1 día |
| TECH-02 | Deuda | useNavigate en lugar de window.location | Baja | 2h |
| TECH-03 | Deuda | Soporte multi-equipo en carga de miembros | Baja | 3h |

---

*Documento generado a partir de revisión funcional del código fuente. Para consultas contactar a Ricardo Cárcamo.*
