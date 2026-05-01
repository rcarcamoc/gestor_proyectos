"""
Tareas programadas del scheduler (alertas, morning briefing, salud semanal).

Perf 1: singleton HTTP client.
Perf 2: singleton Gemini.
Perf 6: morning briefing en paralelo con semáforo (max 5 simultáneos).
Bug 16: todos los mensajes en HTML con escape de caracteres especiales.
"""
import asyncio
import logging
from datetime import time
from telegram.ext import ContextTypes
from http_client import get_http_client

# Max 5 briefings en paralelo para no saturar Gemini ni el backend
_BRIEFING_SEMAPHORE = asyncio.Semaphore(5)


def _esc(text: str) -> str:
    """Escapa caracteres especiales de HTML para nombres de usuario."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def check_and_send_alerts(context: ContextTypes.DEFAULT_TYPE):
    logging.info("Revisando alertas de vencimiento...")
    client = get_http_client()

    try:
        response = await client.get("/telegram/pending-alerts")
        if response.status_code == 200:
            alerts = response.json()
            for alert in alerts:
                chat_id = alert["telegram_chat_id"]
                
                alert_data = (
                    f"Proyecto: {alert['project_name']}\n"
                    f"Tarea: {alert['task_name']}\n"
                    f"Fecha límite: {alert['deadline_human']}\n"
                    f"Tipo de alerta: {alert['tipo']}"
                )

                system_mia = (
                    "Actúa como Mia, la PM divertida y cercana. "
                    "Tu objetivo es recordar al usuario de una tarea que vence pronto o está retrasada. "
                    "Sé simpática, usa humor y emojis. Responde en HTML de Telegram."
                )

                res_completion = await client.post("/telegram/completion", json={
                    "system_prompt": system_mia,
                    "user_prompt": f"Genera un recordatorio para esta tarea: {alert_data}"
                })

                if res_completion.status_code == 200:
                    message = res_completion.json().get("response", "¡Hola! Tienes una tarea pendiente que requiere tu atención.")
                else:
                    message = f"🔔 recordatorio: {alert_data}"

                await context.bot.send_message(chat_id=chat_id, text=message, parse_mode="HTML")
                await client.post("/telegram/mark-alert-sent", json={
                    "task_id": alert["task_id"],
                    "tipo": alert["tipo"],
                    "telegram_chat_id": chat_id,
                })
    except Exception as e:
        logging.error(f"Error en scheduler de alertas: {e}")


async def _send_briefing_to_user(acc: dict, context: ContextTypes.DEFAULT_TYPE):
    """Envía el morning briefing a un usuario con semáforo para control de concurrencia."""
    async with _BRIEFING_SEMAPHORE:
        client = get_http_client()
        try:
            tasks_res = await client.get("/telegram/get-tasks", params={"chat_id": acc["telegram_chat_id"]})
            data = tasks_res.json() if tasks_res.status_code == 200 else []

            if not data:
                await context.bot.send_message(
                    chat_id=acc["telegram_chat_id"],
                    text="☀️ <b>Buenos días</b>\n\nNo tienes tareas pendientes para hoy. ¡Buen momento para planificar! Usa ➕ <b>Nuevo</b>.",
                    parse_mode="HTML",
                )
                return

            system_brief = "Eres SmartTrack Bot. Genera un saludo matutino motivador y un resumen de las tareas reales del usuario. SOLO menciona las tareas que están en los datos. NO inventes tareas ni actividades. Responde en HTML de Telegram."
            
            res_completion = await client.post("/telegram/completion", json={
                "system_prompt": system_brief,
                "user_prompt": str(data)
            })

            if res_completion.status_code == 200:
                briefing = res_completion.json().get("response", "¡Buen día! Aquí tienes tus tareas de hoy.")
            else:
                briefing = "Error cargando resumen matutino."

            await context.bot.send_message(
                chat_id=acc["telegram_chat_id"],
                text=f"☀️ <b>Buenos días</b>\n\n{briefing}",
                parse_mode="HTML",
            )
        except Exception as e:
            logging.error(f"Error en briefing para usuario {acc.get('user_id')}: {e}")


async def send_morning_briefing(context: ContextTypes.DEFAULT_TYPE):
    """
    Perf 6: envía briefings en paralelo (max 5 a la vez) en lugar de secuencialmente.
    Con 100 usuarios: de ~100s a ~20s.
    """
    logging.info("Iniciando envío de Morning Briefings (paralelo)...")
    client = get_http_client()

    try:
        response = await client.get("/telegram/linked-accounts")
        if response.status_code == 200:
            linked_accounts = response.json()
            await asyncio.gather(
                *[_send_briefing_to_user(acc, context) for acc in linked_accounts],
                return_exceptions=True,  # no detener el gather si un usuario falla
            )
    except Exception as e:
        logging.error(f"Error en morning briefing: {e}")


async def check_stalled_tasks(context: ContextTypes.DEFAULT_TYPE):
    logging.info("Buscando tareas estancadas...")
    client = get_http_client()

    try:
        response = await client.get("/telegram/stalled-tasks")
        if response.status_code == 200:
            for task in response.json():
                message = (
                    f"🔍 <b>Detección de estancamiento</b>\n\n"
                    f"He notado que '<b>{_esc(task['task_name'])}</b>' lleva tiempo sin cambios.\n\n"
                    "¿Estás bloqueado o necesitas ayuda para dividirla en pasos más simples?"
                )
                await context.bot.send_message(
                    chat_id=task["telegram_chat_id"], text=message, parse_mode="HTML"
                )
    except Exception as e:
        logging.error(f"Error revisando tareas estancadas: {e}")


async def send_weekly_health_report(context: ContextTypes.DEFAULT_TYPE):
    logging.info("Enviando reportes de salud semanal...")
    client = get_http_client()

    try:
        response = await client.get("/telegram/leader-accounts")
        if response.status_code == 200:
            for leader in response.json():
                stats_res = await client.get("/dashboard/team-health")
                stats = stats_res.json() if stats_res.status_code == 200 else {}

                system_health = "Eres el Analista Estratégico de SmartTrack. Genera un reporte de salud semanal para el líder. Responde en HTML de Telegram."
                
                res_completion = await client.post("/telegram/completion", json={
                    "system_prompt": system_health,
                    "user_prompt": str(stats)
                })

                if res_completion.status_code == 200:
                    report = res_completion.json().get("response", "Aquí tienes el reporte de salud del equipo.")
                else:
                    report = "Error cargando reporte de salud."

                await context.bot.send_message(
                    chat_id=leader["telegram_chat_id"],
                    text=f"📊 <b>Reporte Semanal de Salud</b>\n\n{report}",
                    parse_mode="HTML",
                )
    except Exception as e:
        logging.error(f"Error en reporte semanal: {e}")


def setup_scheduler(application):
    job_queue = application.job_queue
    job_queue.run_repeating(check_and_send_alerts, interval=3600, first=10)
    job_queue.run_daily(send_morning_briefing, time=time(8, 30))
    job_queue.run_repeating(check_stalled_tasks, interval=14400, first=60)
    job_queue.run_daily(send_weekly_health_report, time=time(17, 0), days=(4,))
