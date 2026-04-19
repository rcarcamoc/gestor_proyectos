import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv
from vincular_handler import vincular_handler
from summary_handler import get_resumen
from writing_handler import redactar_handler
from focus_handler import focus_handler, stop_focus_handler
from scheduler_service import setup_scheduler
from natural_language_handler import natural_language_handler, project_conv_handler
from anti_paralysis_handler import anti_paralysis_handler
from recovery_handler import recovery_handler
from team_handler import team_link_handler

load_dotenv()

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_name = update.effective_user.first_name
    await update.message.reply_text(
        f"¡Hola {user_name}! 👋 Bienvenido a SmartTrack Bot.\n\n"
        "Soy tu Project Manager personal. Te ayudaré a gestionar tus proyectos, "
        "recordar tus tareas y redactar comunicaciones profesionales.\n\n"
        "Para empezar, necesito vincular tu cuenta de SmartTrack. "
        "Usa el comando /vincular para comenzar."
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "Comandos disponibles:\n"
        "/start - Bienvenida y presentación\n"
        "/vincular - Conectar tu cuenta de SmartTrack\n"
        "/resumen - Tu resumen diario de hoy\n"
        "/tareas - Lista de tus tareas activas\n"
        "/nuevo - Crear un nuevo proyecto o tarea\n"
        "/redactar - Asistente de redacción con IA\n"
        "/enfocar - Iniciar modo enfoque (Pomodoro)\n"
        "/ayudame - Modo anti-parálisis (ejecución asistida)\n"
        "/recuperar - Recuperar tu contraseña de SmartTrack\n"
        "/parar - Detener modo enfoque\n"
        "/ayuda - Mostrar este mensaje"
    )
    await update.message.reply_text(help_text)

if __name__ == '__main__':
    if not TOKEN or TOKEN == "your_telegram_bot_token_here":
        print("Error: TELEGRAM_BOT_TOKEN no configurado en .env")
    else:
        application = ApplicationBuilder().token(TOKEN).build()

        start_handler = CommandHandler('start', start)
        help_handler = CommandHandler('ayuda', help_command)

        application.add_handler(start_handler)
        application.add_handler(help_handler)
        application.add_handler(vincular_handler)
        application.add_handler(redactar_handler)
        application.add_handler(project_conv_handler)
        application.add_handler(anti_paralysis_handler)
        application.add_handler(recovery_handler)
        application.add_handler(team_link_handler)
        application.add_handler(focus_handler)
        application.add_handler(stop_focus_handler)
        application.add_handler(CommandHandler('resumen', get_resumen))
        
        # El handler de lenguaje natural debe ir al final para no atrapar comandos
        application.add_handler(natural_language_handler)

        setup_scheduler(application)

        print("SmartTrack Bot iniciado...")
        application.run_polling()
