import os
import time
import logging
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler
from session_service import RedisSession

session = RedisSession()
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def start_focus(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Inicia un bloque Pomodoro de 25 minutos.
    /enfocar [duración_minutos]
    """
    chat_id = update.effective_chat.id
    args = context.args
    duration = int(args[0]) if args and args[0].isdigit() else 25

    # Verificar si ya hay una sesión activa
    current_focus = session.get_state(f"focus:{chat_id}")
    if current_focus:
        await update.message.reply_text("⚠️ Ya tienes una sesión de enfoque activa.")
        return

    end_time = time.time() + (duration * 60)
    session.set_state(f"focus:{chat_id}", {"end_time": end_time, "duration": duration}, ex=duration*60 + 300)

    await update.message.reply_text(
        f"🚀 *Modo Enfoque activado* ({duration} min).\n"
        "Estaré en silencio. Te avisaré cuando termine el bloque.\n\n"
        "¡Buen trabajo!",
        parse_mode='Markdown'
    )

    # Programar el aviso de fin
    context.job_queue.run_once(
        finish_focus,
        when=duration * 60,
        chat_id=chat_id,
        name=f"focus_end_{chat_id}"
    )

async def finish_focus(context: ContextTypes.DEFAULT_TYPE):
    job = context.job
    chat_id = job.chat_id

    session.clear_state(f"focus:{chat_id}")

    await context.bot.send_message(
        chat_id=chat_id,
        text="🔔 *¡Tiempo!* El bloque de enfoque ha terminado.\n\n"
             "Tómate un descanso de 5 minutos. ¿Quieres registrar este tiempo en alguna tarea?",
        parse_mode='Markdown'
    )

async def stop_focus(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    session.clear_state(f"focus:{chat_id}")

    # Cancelar el job programado
    current_jobs = context.job_queue.get_jobs_by_name(f"focus_end_{chat_id}")
    for job in current_jobs:
        job.schedule_removal()

    await update.message.reply_text("⏹ Modo enfoque cancelado.")

focus_handler = CommandHandler(['enfocar', 'pomodoro'], start_focus)
stop_focus_handler = CommandHandler('parar', stop_focus)
