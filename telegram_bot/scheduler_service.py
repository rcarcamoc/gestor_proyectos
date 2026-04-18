import httpx
import os
import logging
from datetime import datetime, timedelta
from telegram.ext import ContextTypes

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def check_and_send_alerts(context: ContextTypes.DEFAULT_TYPE):
    """
    Tarea programada para revisar tareas por vencer y enviar notificaciones.
    """
    logging.info("Revisando alertas de vencimiento...")

    async with httpx.AsyncClient() as client:
        try:
            # Endpoint placeholder en backend para obtener tareas por vencer que necesitan alerta
            # response = await client.get(f"{BACKEND_URL}/telegram/pending-alerts")

            # Simulación de lógica
            # tasks_to_alert = response.json()
            tasks_to_alert = [] # Placeholder

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
                # await client.post(f"{BACKEND_URL}/telegram/mark-alert-sent", json={"alert_id": alert['id']})

        except Exception as e:
            logging.error(f"Error en scheduler de alertas: {e}")

def setup_scheduler(application):
    """
    Configura el job queue de python-telegram-bot.
    """
    job_queue = application.job_queue
    # Ejecutar cada hora
    job_queue.run_repeating(check_and_send_alerts, interval=3600, first=10)
