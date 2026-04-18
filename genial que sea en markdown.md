<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# genial que sea en markdown

Aquí va el documento completo. Lo estoy escribiendo directamente en esta respuesta en formato Markdown para que puedas copiarlo:

***

```markdown
# SmartTrack Bot — Especificación de Producto v1.0
**Canal Conversacional con IA para SmartTrack**
*Fecha: Abril 2026 | Estado: Borrador para revisión del equipo*

---

## 1. Contexto y Problema

SmartTrack ya existe como plataforma web de gestión de proyectos con un backend sólido
(FastAPI + MySQL + Docker). Sin embargo, como en la mayoría de los equipos sin un
Project Manager dedicado, el sistema falla por un problema humano, no técnico:
**nadie completa la información de forma consistente**.

El equipo ha probado Trello, ClickUp y planillas de Excel. Todas fallaron por la misma
razón: requieren que el usuario vaya activamente a la herramienta, recuerde completar
los datos, y tenga la disciplina de mantenerla actualizada. Eso no ocurre en la práctica.

**La hipótesis central de este producto:**
> Un asistente conversacional con IA, disponible en Telegram, puede simular el rol de un
> PM operativo: preguntar, insistir, recordar, resumir y ayudar a ejecutar tareas, todo
> desde el canal donde el equipo ya está activo.

---

## 2. Visión del Producto

**SmartTrack Bot no es otro gestor de tareas. Es el PM que el equipo no tiene.**

Su trabajo es:
- **Capturar** información con fricción mínima, mediante conversación natural
- **Completar** los datos faltantes preguntando activamente al usuario
- **Mantener vivo** el trabajo con alertas y seguimiento proactivo
- **Resumir** el estado del día para que el equipo no dependa de abrir la plataforma web
- **Asistir en ejecución** de tareas cognitivamente pesadas (como redactar comunicaciones)

---

## 3. Arquitectura del Sistema ("El Cerebro")

### 3.1 Principio fundamental

> **Una sola fuente de verdad: el backend de SmartTrack (FastAPI + MySQL).**

Ni Telegram ni el frontend tienen datos propios. Ambos son clientes del mismo backend.
El bot es simplemente otro consumidor de la API REST existente.

### 3.2 Las tres capas del bot

```

┌─────────────────────────────────────────────────────┐
│                  USUARIO (Telegram)                  │
└───────────────────────┬─────────────────────────────┘
│ mensaje de texto
▼
┌─────────────────────────────────────────────────────┐
│              CAPA 1: BOT TELEGRAM                    │
│  (python-telegram-bot / aiogram)                     │
│  - Recibe mensajes                                   │
│  - Gestiona estado de conversación por usuario       │
│  - Renderiza respuestas (texto, botones, menús)      │
│  - Ejecuta comandos directos (/resumen, /tareas)     │
└───────────────────────┬─────────────────────────────┘
│ intención + entidades extraídas
▼
┌─────────────────────────────────────────────────────┐
│              CAPA 2: MOTOR DE IA                     │
│  (OpenAI GPT-4o / Gemini via API)                   │
│  - Extrae intención del mensaje                      │
│  - Identifica entidades (proyecto, fecha, tarea)     │
│  - Genera preguntas de completado de datos           │
│  - Redacta textos profesionales                      │
│  - Produce resúmenes ejecutivos                      │
│  - Decide cuándo confirmar antes de persistir        │
└───────────────────────┬─────────────────────────────┘
│ llamadas HTTP con JWT
▼
┌─────────────────────────────────────────────────────┐
│         CAPA 3: BACKEND SMARTTRACK (existente)       │
│  (FastAPI + MySQL + Alembic)                         │
│  - Única fuente de verdad                            │
│  - Autenticación JWT                                 │
│  - CRUD de proyectos, tareas, usuarios               │
│  - Scheduler de alertas                              │
└─────────────────────────────────────────────────────┘

```

### 3.3 Gestión de estado conversacional

Cada usuario del bot tiene un **contexto de sesión** almacenado en memoria (Redis
recomendado o en memoria para MVP):

```json
{
  "user_id": 123,
  "telegram_chat_id": 456789,
  "estado_actual": "creando_proyecto",
  "datos_acumulados": {
    "nombre": "Migración BD",
    "descripcion": null,
    "fecha_inicio": "2026-05-01",
    "fecha_fin": null,
    "responsable": null
  },
  "campos_pendientes": ["descripcion", "fecha_fin", "responsable"],
  "ultimo_mensaje_bot": "¿Cuál es la fecha estimada de entrega?"
}
```

El motor de IA consulta este contexto en cada mensaje para saber qué falta y qué
preguntar a continuación.

### 3.4 Vinculación de cuentas (Identity Bridge)

Flujo de vinculación entre la cuenta Telegram y la cuenta SmartTrack web:

```
1. Usuario escribe /vincular en Telegram
2. Bot genera token temporal (TTL: 10 minutos) y lo guarda en el backend
3. Bot envía: "Ve a smarttrack.app/vincular y usa el código: ABC-123"
4. Usuario ingresa el código en el frontend web
5. Backend asocia telegram_chat_id con user_id
6. Bot confirma: "¡Listo! Tu cuenta está vinculada, [Nombre]."
```

Sin este paso completado, el bot responde pero no puede acceder a datos personales.

---

## 4. Módulos Funcionales

### Módulo 1: Creación Guiada de Proyectos (PM Conversacional)

**Problema que resuelve:** El equipo no completa los formularios. La IA actúa como
entrevistador y completa la ficha del proyecto mediante conversación.

**Flujo:**

```
Usuario: "Nuevo proyecto: rediseño de la app móvil"
Bot:     "Entendido. ¿Cuál es el objetivo principal de este proyecto?"
Usuario: "Mejorar la UX para reducir el churn"
Bot:     "Perfecto. ¿Cuándo necesitas tenerlo listo?"
Usuario: "Para el 30 de junio"
Bot:     "¿Quién es el responsable principal, tú o alguien del equipo?"
Usuario: "Ana Martínez"
Bot:     "Resumen del proyecto:
          📋 Nombre: Rediseño App Móvil
          🎯 Objetivo: Mejorar UX para reducir churn
          📅 Fecha fin: 30 junio 2026
          👤 Responsable: Ana Martínez
          ¿Lo creo así o hay algo que ajustar?"
Usuario: "Sí, créalo"
Bot:     "✅ Proyecto creado. ¿Agregamos la primera tarea?"
```

**Reglas del motor de IA:**

- Siempre confirmar antes de persistir datos
- Máximo 2 preguntas por turno (evitar sensación de formulario)
- Si el usuario da info parcial, extraerla y preguntar solo lo que falta
- Tono: directo, profesional, nunca robótico

**Campos mínimos para crear un proyecto:**

- Nombre (obligatorio)
- Objetivo/descripción (obligatorio)
- Fecha estimada de fin (obligatorio)
- Responsable (obligatorio)

**Campos opcionales que el bot puede completar después:**

- Equipo, hitos, prioridad, presupuesto

---

### Módulo 2: Gestión de Tareas

**Creación de tareas:**

Similar al flujo de proyectos. El bot pregunta:

1. ¿A qué proyecto pertenece? (muestra lista si hay más de uno)
2. ¿Cuál es la descripción de la tarea?
3. ¿Fecha de vencimiento?
4. ¿Quién la hace?
5. ¿Prioridad? (Alta / Media / Baja — botones inline)

**Actualización de estado:**

```
Usuario: "Marqué como lista la tarea de mockups"
Bot:     "¿Cuál de estas tareas? [botones con tareas activas]"
Usuario: [selecciona]
Bot:     "✅ Tarea 'Mockups pantalla inicio' marcada como completada."
```

**Listado de tareas del día:**

```
/tareas → Bot responde con las tareas del usuario para hoy,
          agrupadas por proyecto, con estado e ícono de prioridad
```


---

### Módulo 3: Sistema de Alertas Proactivas

**El bot avisa sin que el usuario lo pida.**

**Configuración de alertas (por defecto):**

- 48 horas antes del vencimiento de una tarea: primera alerta
- 24 horas antes: segunda alerta con mayor urgencia
- En el día de vencimiento: alerta crítica

**Formato de alerta:**

```
⚠️ Vence mañana

Proyecto: Rediseño App Móvil
Tarea: Entrega de wireframes
📅 Vence: mañana a las 18:00
👤 Responsable: Tú

¿Qué necesitas?
[Ya está lista] [Necesito más tiempo] [Recordar en 2h]
```

**Lógica del scheduler:**

- Proceso en background (APScheduler o Celery) que corre cada hora
- Consulta tareas con vencimiento en las próximas 48h
- Verifica si ya se envió alerta para esa tarea (tabla `alertas_enviadas`)
- Si no, envía via Telegram Bot API y registra el envío

**Alerta de datos incompletos (el bot persigue la información faltante):**

```
🔔 Hey, el proyecto "Rediseño App Móvil" aún no tiene
   fecha de inicio ni equipo asignado.
   ¿Los completamos ahora? [Sí, ahora] [Más tarde]
```


---

### Módulo 4: Resumen Diario

**Comando:** `/resumen` o automático cada mañana (hora configurable)

**Estructura del resumen:**

```
📊 Tu resumen de hoy — Sábado 18 de abril

✅ Completado ayer: 3 tareas
⏳ En progreso: 5 tareas (2 proyectos)
🔴 Vencen hoy: 1 tarea
⚠️ Atrasadas: 2 tareas

📋 PRIORIDAD HOY:
1. [ALTA] Entrega wireframes — Rediseño App
2. [ALTA] Reunión cliente — Proyecto X
3. [MEDIA] Review de código — API v2

¿Quieres detalles de algún proyecto específico?
```

**La IA genera el resumen llamando al backend y sintetizando:**

- Tareas completadas ayer
- Tareas activas del usuario
- Tareas con vencimiento próximo
- Proyectos con datos incompletos

---

### Módulo 5: Asistente de Redacción

**Problema que resuelve:** Tareas de comunicación que generan fricción cognitiva alta y
baja recompensa (correos, mensajes formales, actualizaciones de estado). Especialmente
relevante para usuarios con TDAH o tendencia a postergar estas tareas.

**El bot no envía emails directamente** (restricciones de seguridad corporativa).
Su rol es **eliminar la barrera de la página en blanco** y entregar el texto listo
para copiar y pegar.

**Flujo de redacción:**

```
Usuario: "Necesito escribirle a mi jefe que el proyecto se va a
          retrasar 2 semanas por un problema con el proveedor,
          pero que ya tenemos plan de contingencia"

Bot:     "Entendido. ¿Cómo quieres sonar?
          [Formal y directo] [Formal con contexto] [Breve y al punto]"

Usuario: [selecciona Formal y directo]

Bot:     "---
          Asunto: Actualización — Retraso en Proyecto [Nombre]

          Estimado/a [Nombre],

          Te escribo para informarte que el proyecto presentará
          un retraso de aproximadamente dos semanas debido a
          demoras con uno de nuestros proveedores clave.

          Ya contamos con un plan de contingencia en marcha para
          minimizar el impacto. Te mantendré informado/a de los
          avances en los próximos días.

          Quedo disponible para conversar si lo necesitas.

          Saludos,
          [Tu nombre]
          ---

          ¿Lo ajustamos o está listo para copiar?"
```

**Capacidades del asistente de redacción:**

- Correos de actualización de proyecto
- Mensajes de retraso / disculpa profesional
- Solicitudes a terceros (proveedores, clientes)
- Resúmenes de reunión
- Actualizaciones de estado para stakeholders

**Opciones de tono:** Formal | Directo | Empático | Breve

**Contexto automático:** Si la tarea tiene un proyecto asociado en SmartTrack, el bot
ya conoce el nombre del proyecto, fechas y responsables — no hay que re-explicar.

---

### Módulo 6: Modo Ejecución Asistida (Anti-Parálisis)

**Problema que resuelve:** La brecha entre tener la intención de hacer algo y
ejecutarlo. Para usuarios con TDAH o alta carga cognitiva, tareas "fáciles" se
postergan porque el umbral de activación es mayor que la recompensa percibida.

**Funcionamiento:**

El usuario puede declarar una tarea que necesita apoyo para ejecutar:

```
Usuario: "Necesito ayuda para enviar ese correo a Juan, lo tengo
          redactado pero no lo envío"

Bot:     "Entendido. Te acompaño.
          Primero: ¿tienes el correo abierto en este momento?
          [Sí] [Voy a abrirlo]"

[usuario responde Sí]

Bot:     "Perfecto. ¿Ya tiene asunto?
          [Sí] [No, lo definimos]"

[usuario responde Sí]

Bot:     "Bien. ¿Está el destinatario correcto?
          [Sí] [Verificar]"

[usuario responde Sí]

Bot:     "Todo listo. Dale clic en Enviar ahora.
          Dime cuando lo hagas 👊"

[usuario confirma]

Bot:     "✅ ¡Listo! Eso era todo lo que bloqueaba.
          ¿Quieres registrarlo como tarea completada?"
```

**Principios de diseño:**

- Preguntas de sí/no con botones — decisión mínima por paso
- El bot actúa como *body double* digital: presencia que mantiene el foco
- Nunca presionar ni generar culpa — tono siempre neutro y de apoyo
- Timebox opcional: "¿Quieres que te acompañe 5 minutos para terminarlo ahora?"

---

## 5. Comandos del Bot

| Comando | Descripción |
| :-- | :-- |
| `/start` | Bienvenida y vinculación de cuenta |
| `/vincular` | Conectar cuenta Telegram con SmartTrack |
| `/resumen` | Resumen del día actual |
| `/tareas` | Listado de tareas activas del usuario |
| `/proyectos` | Listado de proyectos activos |
| `/nuevo` | Iniciar creación de proyecto o tarea |
| `/redactar` | Asistente de redacción de comunicaciones |
| `/ayuda` | Listado de comandos disponibles |
| `/feedback` | Enviar comentario o reporte de problema |

Además del modo comando, el bot responde a **lenguaje natural** para las acciones más
comunes. El usuario puede escribir "nueva tarea" o "cuáles son mis pendientes de hoy"
y el bot lo interpreta correctamente.

---

## 6. Integración con el Frontend Web

El bot y el frontend son **complementarios, no excluyentes**. La misma funcionalidad
puede iniciarse en cualquier canal:


| Acción | Telegram | Frontend Web |
| :-- | :-- | :-- |
| Crear proyecto | Conversación guiada | Formulario completo |
| Agregar tarea | Lenguaje natural | Formulario en contexto |
| Ver estado | `/resumen` | Dashboard |
| Redactar comunicación | Chat con IA | Editor con IA integrado |
| Ver historial | Comandos básicos | Vista completa con filtros |
| Configurar alertas | Configuración básica | Panel completo |

**Regla de diseño:** Telegram es la **boca** (captura rápida, acción en movimiento).
El frontend es el **cerebro** (planificación, análisis, gestión completa).

Lo que se crea en uno aparece inmediatamente en el otro.

---

## 7. Modelo de Datos — Cambios Requeridos

### Tablas nuevas necesarias:

```sql
-- Vinculación de cuentas Telegram
CREATE TABLE telegram_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    vinculado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Tokens temporales para vinculación
CREATE TABLE vinculation_tokens (
    token VARCHAR(10) PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    expira_en TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE
);

-- Registro de alertas enviadas (evitar duplicados)
CREATE TABLE alertas_enviadas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id),
    tipo_alerta VARCHAR(50) NOT NULL, -- '48h', '24h', 'dia_vencimiento'
    enviada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    telegram_chat_id BIGINT NOT NULL
);

-- Historial de redacciones (para aprender el estilo del usuario)
CREATE TABLE redacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    tipo VARCHAR(100),  -- 'retraso', 'actualizacion', 'solicitud'
    tono VARCHAR(50),   -- 'formal', 'directo', 'empatico'
    input_usuario TEXT,
    output_generado TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```


---

## 8. Stack Tecnológico Recomendado

### Bot y orquestación:

- **python-telegram-bot v21+** (async nativo, bien mantenido)
- **APScheduler** para el scheduler de alertas en background
- **Redis** para estado de sesión conversacional (TTL por sesión)


### IA:

- **OpenAI GPT-4o** (recomendado por precisión en extracción de entidades)
- Fallback: **Gemini 1.5 Flash** (menor costo para operaciones simples)
- Estrategia: usar modelo liviano para intención simple, modelo potente para redacción


### Infraestructura:

- El bot corre como un **nuevo servicio en el docker-compose existente**
- No requiere cambios en el backend actual, solo nuevos endpoints si hacen falta
- Variables de entorno nuevas: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `REDIS_URL`


### Nuevo servicio en docker-compose:

```yaml
telegram-bot:
  build: ./telegram_bot
  environment:
    - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - SMARTTRACK_API_URL=http://backend:8000
    - REDIS_URL=redis://redis:6379
  depends_on:
    - backend
    - redis
  restart: unless-stopped
```


---

## 9. Roadmap de Implementación

### Fase Alpha (solo el desarrollador) — 2 semanas

**Objetivo:** Validar que el bot puede leer y escribir datos correctamente.

- [ ] Vinculación de cuentas Telegram ↔ SmartTrack
- [ ] Comando `/resumen` (solo lectura)
- [ ] Comando `/tareas` (solo lectura)
- [ ] Alertas de vencimiento (48h y 24h)


### Fase Beta Cerrada (2-3 personas de confianza) — 2 semanas

**Objetivo:** Validar flujos de escritura y conversación básica.

- [ ] Creación de tareas por lenguaje natural
- [ ] Actualización de estado de tareas
- [ ] Creación de proyectos guiada por IA
- [ ] Comando `/feedback` activo desde el día 1


### Fase Beta Equipo (todos) — 3 semanas

**Objetivo:** Validar asistente de redacción y modo ejecución asistida.

- [ ] Asistente de redacción (`/redactar`)
- [ ] Modo ejecución asistida (body double digital)
- [ ] Alertas de datos incompletos
- [ ] Ajustes basados en feedback de fases anteriores


### Post-Beta

- Historial de redacciones y aprendizaje de estilo
- Resumen semanal automatizado
- Integración del asistente de redacción en el frontend web
- Panel de configuración de alertas en frontend

---

## 10. Criterios de Éxito

### Métrica principal:

> **¿El equipo completa más datos en SmartTrack que antes del bot?**

### Métricas secundarias:

- % de proyectos con todos los campos obligatorios completos (objetivo: >80%)
- % de tareas con fecha de vencimiento asignada (objetivo: >90%)
- Tasa de respuesta a alertas del bot (objetivo: >60%)
- Uso del asistente de redacción (al menos 1 uso por semana por usuario)
- Retención: ¿el equipo sigue usando el bot después de 30 días?


### Señal de fracaso temprano:

Si después de la fase Beta Cerrada el bot tiene más de 3 errores de comprensión por día,
revisar el sistema de extracción de intención antes de continuar.

---

## 11. Consideraciones de Seguridad

- El bot **nunca almacena credenciales de email ni accede a sistemas corporativos externos**
- Toda autenticación se hace vía JWT del backend SmartTrack
- Los tokens de vinculación tienen TTL de 10 minutos y se invalidan después del primer uso
- Los mensajes de Telegram no se almacenan, solo las acciones resultantes
- El historial de redacciones es opcional y el usuario puede desactivarlo

---

## 12. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
| :-- | :-- | :-- |
| El bot no entiende el mensaje | Media | Fallback: ofrecer menú de opciones cuando la confianza de la IA es baja |
| El equipo deja de usarlo después de la novedad | Alta | Hacer que el resumen diario sea automático y difícil de ignorar |
| Datos guardados incorrectamente por malentendido | Baja | Siempre confirmar antes de persistir; historial de cambios en el backend |
| Costo de API de IA demasiado alto | Media | Usar modelo liviano para operaciones simples; solo GPT-4o para redacción |
| Notificaciones excesivas generan fatiga | Media | Máximo 2 alertas por tarea; configuración personalizable de horarios |


---

*Documento preparado para revisión del equipo de desarrollo.*
*Siguiente paso recomendado: sesión de refinamiento para estimar esfuerzo por módulo.*

```

***

Ese es el documento completo. Tiene todo lo que necesita el equipo de desarrollo para entender el producto, la arquitectura, la lógica del cerebro, los módulos, el stack recomendado y el roadmap de implementación.

Los puntos más importantes que destaco:

- **La arquitectura de 3 capas** (bot → IA → backend existente) es el corazón técnico — el equipo debe tener claridad total sobre eso antes de empezar
- **El Módulo 6 (Anti-Parálisis)** es el más diferenciador y ningún competidor lo tiene — vale la pena destacarlo al presentarlo
- **El roadmap en 3 fases** protege la adopción: primero tú, luego pocos, luego todos

¿Quieres que lo genere como archivo `.md` descargable o ajustamos algo antes?```

