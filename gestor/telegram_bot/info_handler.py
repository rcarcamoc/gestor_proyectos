"""
Handlers de consulta de información (proyectos, tareas, métricas, etc.).

Perf 1: usa http_client singleton en lugar de crear AsyncClient por request.
Perf 2: usa gemini_client singleton en lugar de instanciar GeminiService aquí.
Perf 3: cachea resultados de get-tasks y get-projects 30s en Redis.
"""
import logging
from telegram import Update
from telegram.ext import ContextTypes
from http_client import get_http_client
from session_service import RedisSession

session = RedisSession()


async def fetch_and_respond(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    url: str,
    method: str = "GET",
    payload: dict = None,
    prompt_context: str = "",
    cache_key: str = None,
    cache_ttl: int = 30,
):
    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action="typing")

    client = get_http_client()

    try:
        # Obtener contexto del usuario para Mia
        from context_builder import build_user_context
        user_ctx = await build_user_context(chat_id)
        
        # Perf 3: intentar caché antes de llamar al backend
        data = None
        if method == "GET" and cache_key:
            data = session.get_cached(f"{cache_key}:{chat_id}")

        if data is None:
            if method == "GET":
                final_url = url
                params = {"chat_id": chat_id} if "chat_id" not in url else {}
                res = await client.get(final_url, params=params)
            else:
                body = payload or {}
                body["telegram_chat_id"] = chat_id
                res = await client.post(url, json=body)

            if res.status_code != 200:
                await update.effective_message.reply_text(
                    "Uy, parece que el servidor está un poco tímido hoy 🙈. ¿Intentamos de nuevo en un ratito?"
                )
                return

            data = res.json()

            if method == "GET" and cache_key:
                session.set_cached(f"{cache_key}:{chat_id}", data, ex=cache_ttl)

        # Usar la personalidad de Mia para responder vía backend
        history = context.user_data.get('history', [])
        
        # Convertir data a string legible para el prompt
        data_str = str(data)
        
        # Construir el context prompt para Mia
        system_mia = f"Eres Mia, la PM de SmartTrack. Responde al usuario de forma amigable basándote en los datos: {data_str}. Responde en HTML de Telegram."
        user_prompt = f"Contexto de la acción: {prompt_context}"
        
        res_completion = await client.post("/telegram/completion", json={
            "system_prompt": system_mia,
            "user_prompt": user_prompt
        })
        
        if res_completion.status_code == 200:
            response_text = res_completion.json().get("response", "No pude procesar la respuesta.")
        else:
            response_text = "Tengo problemas conectando con mi cerebro central 🙈."
        
        await update.effective_message.reply_text(response_text, parse_mode="HTML")

        # Actualizar historial
        history.append(f"Usuario: {prompt_context}")
        history.append(f"Mia: {response_text}")
        context.user_data['history'] = history[-10:]

    except Exception as e:
        logging.error(f"Error en fetch_and_respond [{url}]: {e}")
        await update.effective_message.reply_text("Lo siento, tuve un problema procesando tu solicitud. Por favor intenta de nuevo en unos momentos.")


async def handle_get_projects(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/get-projects",
        prompt_context="El usuario quiere ver sus proyectos activos.",
        cache_key="projects", cache_ttl=30,
    )

async def handle_get_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/get-tasks",
        prompt_context="El usuario quiere ver sus tareas pendientes.",
        cache_key="tasks", cache_ttl=30,
    )

async def handle_assign_task(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    task_name = entities.get("task_name")
    assignee = entities.get("assignee")
    if not task_name or not assignee:
        await update.effective_message.reply_text(
            "Necesito saber qué tarea asignar y a quién. "
            "Por ejemplo: 'Asigna la tarea de diseño a Juan'."
        )
        return
    await fetch_and_respond(
        update, context, "/telegram/assign-task", method="POST",
        payload={"task_name": task_name, "assignee_name": assignee},
        prompt_context=f"El usuario asignó la tarea {task_name} a {assignee}.",
    )
    # Invalidar caché de tareas porque el estado cambió
    session.invalidate_cache(f"tasks:{update.effective_chat.id}")

async def handle_update_task_status(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    task_name = entities.get("task_name")
    status = entities.get("status")
    if not task_name or not status:
        await update.effective_message.reply_text(
            "Necesito saber qué tarea actualizar y su nuevo estado. "
            "Ejemplo: 'La tarea de diseño está terminada'."
        )
        return
    await fetch_and_respond(
        update, context, "/telegram/update-task-status", method="POST",
        payload={"task_name": task_name, "status": status},
        prompt_context=f"El usuario actualizó la tarea {task_name} a {status}.",
    )
    session.invalidate_cache(f"tasks:{update.effective_chat.id}")

async def handle_update_deadline(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    name = entities.get("project_name") or entities.get("task_name")
    deadline = entities.get("deadline")
    if not name or not deadline:
        await update.effective_message.reply_text(
            "Necesito el nombre de la tarea/proyecto y la nueva fecha. "
            "Ejemplo: 'Mueve la entrega del diseño al 2026-05-01'."
        )
        return
    await fetch_and_respond(
        update, context, "/telegram/update-deadline", method="POST",
        payload={"project_or_task_name": name, "deadline": deadline},
        prompt_context=f"El usuario actualizó la fecha de {name} a {deadline}.",
    )

async def handle_get_projects_at_risk(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/projects-at-risk",
        prompt_context="El gerente quiere ver qué proyectos están en riesgo.",
        cache_key="projects_at_risk", cache_ttl=60,
    )

async def handle_get_project_metrics(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    project_name = entities.get("project_name")
    if not project_name:
        await update.effective_message.reply_text("¿De qué proyecto quieres ver las métricas?")
        return
    await fetch_and_respond(
        update, context, f"/telegram/project-metrics",
        prompt_context=f"El gerente quiere métricas del proyecto {project_name}.",
        payload=None,
        # pasamos como param vía URL manual porque es GET con query string
        cache_key=f"metrics_{project_name}", cache_ttl=60,
    )

async def handle_find_available_team(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/available-team",
        prompt_context="El gerente quiere saber qué equipo tiene disponibilidad.",
        cache_key="available_team", cache_ttl=60,
    )

async def handle_get_team_summary(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/team-summary",
        prompt_context="El líder quiere un resumen de lo que ha hecho el equipo.",
        cache_key="team_summary", cache_ttl=60,
    )

async def handle_reassign_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await update.effective_message.reply_text(
        "Para reasignar masivamente, por favor usa la plataforma web por seguridad."
    )

async def handle_get_team_blockers(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/team-blockers",
        prompt_context="El líder quiere ver qué tareas del equipo están bloqueadas.",
        cache_key="team_blockers", cache_ttl=30,
    )

async def handle_get_next_action(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    await fetch_and_respond(
        update, context, "/telegram/next-action",
        prompt_context="El usuario quiere saber qué es lo más prioritario que debe hacer.",
        cache_key="next_action", cache_ttl=30,
    )

async def handle_request_help(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    task_name = entities.get("task_name")
    if not task_name:
        await update.effective_message.reply_text("¿Con qué tarea necesitas ayuda?")
        return
    await fetch_and_respond(
        update, context, "/telegram/request-help", method="POST",
        payload={"task_name": task_name},
        prompt_context=f"El usuario pidió ayuda y bloqueó la tarea {task_name}.",
    )
    session.invalidate_cache(f"tasks:{update.effective_chat.id}")

async def handle_log_time(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    task_name = entities.get("task_name")
    hours = entities.get("hours")
    if not task_name or not hours:
        await update.effective_message.reply_text(
            "Necesito saber la tarea y cuántas horas registraste. "
            "Ejemplo: 'Anota 2 horas en el diseño'."
        )
        return
    try:
        h = float(hours)
    except Exception:
        h = 1.0
    await fetch_and_respond(
        update, context, "/telegram/log-time", method="POST",
        payload={"task_name": task_name, "hours": h},
        prompt_context=f"El usuario registró {h} horas en la tarea {task_name}.",
    )
