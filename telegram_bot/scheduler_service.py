import httpx
import os
import logging
from datetime import datetime, time, timedelta
from telegram.ext import ContextTypes
from gemini_service import GeminiService

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
gemini = GeminiService()

async def check_and_send_alerts(context: ContextTypes.DEFAULT_TYPE):
    """
    Tarea programada para revisar tareas por vencer y enviar notificaciones.
    """
    logging.info("Revisando alertas de vencimiento...")

    async with httpx.AsyncClient() as client:
        try:
            # Endpoint en backend para obtener tareas por vencer que necesitan alerta
            response = await client.get(f"{BACKEND_URL}/telegram/pending-alerts")

            if response.status_code == 200:
                tasks_to_alert = response.json()
                for alert in tasks_to_alert:
                    chat_id = alert['telegram_chat_id']
                    message = (
                        f"⚠️ *Vence pronto*\n\n"
                        f"Proyecto: {alert['project_name']}\n"
                        f"Tarea: {alert['task_name']}\n"
                        f"📅 Vence: {alert['deadline_human']}\n\n"
                        "¿Cómo vas con esto?"
                    )
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=message,
                        parse_mode='Markdown'
                    )

                    # Registrar envío para evitar duplicados
                    await client.post(f"{BACKEND_URL}/telegram/mark-alert-sent", json={"alert_id": alert['id']})

        except Exception as e:
            logging.error(f"Error en scheduler de alertas: {e}")

async def send_morning_briefing(context: ContextTypes.DEFAULT_TYPE):
    """
    Envía un resumen matutino personalizado a todos los usuarios vinculados.
    """
    logging.info("Iniciando envío de Morning Briefings...")

    async with httpx.AsyncClient() as client:
        try:
            # 1. Obtener todos los usuarios vinculados
            response = await client.get(f"{BACKEND_URL}/telegram/linked-accounts")
            if response.status_code == 200:
                linked_accounts = response.json()

                for acc in linked_accounts:
                    chat_id = acc['telegram_chat_id']
                    user_id = acc['user_id']

                    # 2. Obtener datos del dashboard para este usuario
                    dashboard_res = await client.get(f"{BACKEND_URL}/dashboard/member?user_id={user_id}")
                    data = dashboard_res.json() if dashboard_res.status_code == 200 else {}

                    # 3. Usar Gemini para generar el briefing
                    prompt = (
                        "Eres SmartTrack Bot. Genera un saludo matutino motivador y un resumen "
                        "estratégico de las tareas de hoy para el usuario. "
                        "Prioriza lo que vence pronto y detecta huecos libres. Responde en Markdown."
                    )

                    briefing = await gemini.generate_response(prompt, str(data))

                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=f"☀️ *Buenos días*\n\n{briefing}",
                        parse_mode='Markdown'
                    )

        except Exception as e:
            logging.error(f"Error en envío de morning briefing: {e}")

async def check_stalled_tasks(context: ContextTypes.DEFAULT_TYPE):
    """
    Detecta tareas que llevan mucho tiempo en progreso sin actividad.
    """
    logging.info("Buscando tareas estancadas...")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BACKEND_URL}/telegram/stalled-tasks")
            if response.status_code == 200:
                stalled_tasks = response.json()

                for task in stalled_tasks:
                    chat_id = task['telegram_chat_id']
                    task_name = task['task_name']

                    message = (
                        f"🔍 *Detección de estancamiento*\n\n"
                        f"He notado que '{task_name}' lleva tiempo en progreso sin cambios.\n\n"
                        "¿Estás bloqueado por algo o necesitas ayuda para dividir la tarea en pasos más simples?"
                    )
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=message,
                        parse_mode='Markdown'
                    )
        except Exception as e:
            logging.error(f"Error revisando tareas estancadas: {e}")

async def send_weekly_health_report(context: ContextTypes.DEFAULT_TYPE):
    """
    Envía un reporte de salud del equipo a líderes y owners cada semana.
    """
    logging.info("Enviando reportes de salud semanal...")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BACKEND_URL}/telegram/leader-accounts")
            if response.status_code == 200:
                leaders = response.json()

                for leader in leaders:
                    chat_id = leader['telegram_chat_id']

                    # Obtener métricas agregadas del equipo
                    stats_res = await client.get(f"{BACKEND_URL}/dashboard/team-health")
                    stats = stats_res.json() if stats_res.status_code == 200 else {}

                    prompt = (
                        "Eres el Analista Estratégico de SmartTrack. Genera un reporte de salud semanal "
                        "para el líder del equipo. Sé directo, resalta cuellos de botella y "
                        "felicita al equipo por los logros. Responde en Markdown."
                    )

                    report = await gemini.generate_response(prompt, str(stats))

                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=f"📊 *Reporte Semanal de Salud*\n\n{report}",
                        parse_mode='Markdown'
                    )
        except Exception as e:
            logging.error(f"Error en reporte semanal: {e}")

def setup_scheduler(application):
    """
    Configura el job queue de python-telegram-bot.
    """
    job_queue = application.job_queue
    # Ejecutar cada hora para alertas generales
    job_queue.run_repeating(check_and_send_alerts, interval=3600, first=10)

    # Programar Morning Briefing a las 08:30 cada día
    job_queue.run_daily(send_morning_briefing, time=time(8, 30))

    # Revisar bloqueos cada 4 horas
    job_queue.run_repeating(check_stalled_tasks, interval=14400, first=60)

    # Reporte de salud semanal (Viernes a las 17:00)
    job_queue.run_daily(send_weekly_health_report, time=time(17, 0), days=(4,))
