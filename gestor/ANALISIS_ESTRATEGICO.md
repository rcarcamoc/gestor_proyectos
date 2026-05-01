# Análisis Estratégico y Plan de Producto — SmartTrack MVP

Este documento evalúa de manera integral el proyecto SmartTrack, tomando el `PLAN_DE_TRABAJO.md` como base, y elevando sus capacidades para cumplir con la premisa de ser un sistema inteligente de optimización multi-proyecto y multi-usuario.

---

## 1. Análisis de Producto (UX/UI)

Para diferenciarse verdaderamente y no ser "un tablero más", la experiencia de usuario debe girar en torno a la prevención y la claridad de capacidad.

*   **Faltante Crítico (Dashboard Ejecutivo)**: Hoy en día, los gestores (Monday, ClickUp) requieren cambiar de "espacio" para ver la capacidad. SmartTrack requiere una vista superior de *Portfolio o Capacity Management* (Hito 2.1 del plan base) que integre una "Tarjeta de Salud de Equipo" en tiempo real. 
*   **Micro-Interacciones Predictivas**: Cuando el usuario está por asignar una tarea crítica a un empleado que ya está sobrecargado, la UI debe anticipar esto con un "pop-up" (Modal de Advertencia Frontal) *antes* del guardado. 
*   **UX Híbrida**: Fluidez estructural para que la UI funcione tanto si el proyecto es gestionado como Backlog (Scrum) o como Flujo Continuo (Kanban), manteniendo la métrica central de *Horas Comprometidas vs. Disponible*.

---

## 2. Arquitectura Técnica

Desde la perspectiva del **CTO**, para lograr una escalabilidad multi-tenant confiable y la ejecución de algoritmos del motor predictivo, la arquitectura debe asegurar:

*   **Seguridad Multi-Tenant Inquebrantable**: Ya existe el modelo basado en `organization_id`. Se debe garantizar mediante Row-Level Security (RLS) en la BDD o políticas estrictas en los endpoints que en modelos de agregación (Dashboard Consolidado), los identificadores y queries jamás se crucen.
*   **Algoritmos de Optimización de Recursos y Skills**: El endpoint `POST /engine/suggest-assignee` es la base (70% skills, 30% disponibilidad). Sin embargo, se requiere un sistema que se alimente de métricas históricas de desviaciones de tiempo (`task_metrics`) para sugerir *pesos dinámicos*. Si un junior estima 4h, el sistema podría internamente ajustar a 6h basándose en históricos.
*   **Predicción de Capacidad con procesamiento Asíncrono (Futuro)**: El cálculo profundo "cross-project" (Hito 2.2) al crecer requerirá procesamiento en background (ej. Celery/Redis) en lugar de resolución síncrona en el API request para evitar latencia, especialmente en equipos de más de 50 personas interactuando.

---

## 3. Gestión Multi-Proyecto (Senior Project Manager Perspective)

*   **Superación de la Vista Aislada (Silo)**: La capacidad de ver el progreso integral de un recurso. SmartTrack debe contestar a la pregunta: *"Si le paso este hotfix a la desarrolladora líder, ¿cuál de todos sus proyectos actuales va a no llegar a su fecha límite?"*
*   **Predicción de Conflictos de Capacidad ("What-If Simulator")**: Implementar un entorno seguro en el sistema donde el Project Manager pueda crear proyectos en modo "Phantom/Borrador" y visualizar el impacto temporal en su organización antes de aprobar y volver reales esas tareas.
*   **Diagnóstico Automático de Metodología**: El sistema debería poder sugerir métricas basadas en cómo crea tareas el PM. Si el ciclo es corto, activar vistas Kanban y mediciones de Lead Time. Si hay planning estructurado, activar vistas de Sprint Metrics.

---

## 4. Estrategia de Negocio y Posicionamiento (CEO Perspective)

*   **Diferenciación Competitiva frente a Estándares**:
    *   *Jira Portfolio*: Excesivo y complejo en configuración. Requiere un experto para setear esquemas. SmartTrack es de configuración "zero-friction" y provee alertas intuitivas (Smart Defaults).
    *   *Monday/ClickUp*: Excelentes vistas tabulares, pero son gestores reactivos (el PM debe sacar conclusiones). SmartTrack es un **sistema proactivo**: él mismo infiere quién es el ideal y avisa proactivamente a la gerencia sobre riesgos.
*   **Propuesta de Valor Única**: *Optimización inteligente de capacidad humana que previene el burnout y asegura los deadlines cruzados de múltiples proyectos.*
*   **Roadmap de Monetización (Ejemplo)**:
    *   **Free**: Gestión básica (Estilo Trello), manual.
    *   **Pro**: Algoritmos de sugerencia (Skills base) e impacto de capacidad actual.
    *   **Enterprise**: Modelo "What-If" Predictivo, reportes de mitigación de burnout e integraciones con ecosistemas corporativos.

---

## 5. Matriz de Decisión Metodologías (Gestor Especialista)

| Contexto del Equipo / Proyecto | Metodología Categórica | Foco del Algoritmo SmartTrack |
| :--- | :--- | :--- |
| **Soporte / Fixes Operativos** | **Kanban** | Medición de Lead Time, Alertas al detectar un WIP (Work in Progress) elevado por recurso (Cuello de Botella). |
| **Desarrollo de Producto Activo** | **Scrum** | Cálculo de *Velocity* consolidada. Alertar cuando la capacidad comprometida supera a las horas del sprint (Overcommitment). |
| **Consultoría / Agencias Múltiples** | **Híbrido / Waterfall** | Dependencias fuertes entre recursos y fechas tope cerradas. Motor vigilando de cerca los bloqueos de Gantt. |

---

## 6. Prioridades Críticas (Ordenadas por Impacto Diferenciador)

Para ejecutar el desarrollo del MVP convirtiéndolo en un software "Next-Gen", el roadmap debe seguir estrictamente este orden:

1.  **[Core Algoritmo] Alerta Preventiva Cross-Project (Alto Impacto)**: 
    *   Lograr la base técnica (`check-cross-project-impact`) mencionada en el Hito 2.2. Es el "Wow effect" cuando el PM recibe una advertencia que le evita cometer un error en producción.
2.  **[Visualización] Dashboard Multi-Proyecto "Capacity" (Alto Impacto Visibilidad)**: 
    *   Implementar la vista consolidada (Hito 2.1). Un panel de "luces" (Rojo, Amarillo, Verde) sobre las personas, para resolver el problema de la "caja negra" gerencial de capacidad.
3.  **[Automatización] Matching Sugerido Basado en Skills y Disponibilidad (Impacto Medio/Alto)**: 
    *   El motor que permite acelerar la delegación (Hito 2.3). Promediar variables para devolver opciones viables.
4.  **[Estabilidad] Pipeline de CI/CD Cero Tolerancia (Fundacional)**: 
    *   Un producto de análisis profundo requiere que el código pase `tests unitarios de la lógica del motor de impacto` sin fallar. Hito 4.1.
5.  **[Engagement UX] Notificaciones in-app del Motor Predictivo**: 
    *   Hito 3.1. Convertir a SmartTrack en algo útil y dinámico; el motor no solo debe ser un candado activo durante la creación, sino un compañero que envía una alerta si una eventualidad rompió un timeline.
