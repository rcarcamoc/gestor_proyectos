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
from info_handler import handle_get_tasks
from natural_language_handler import start_project_creation

load_dotenv()

# Configuration
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"

# Logging
log_level = logging.DEBUG if DEV_MODE else logging.INFO
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=log_level
)
logger = logging.getLogger(__name__)

if DEV_MODE:
    logger.info("🛠️ Bot iniciado en MODO DESARROLLO (Logging: DEBUG)")

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log the error and send a telegram message to notify the developer."""
    logger.error("Ocurrió una excepción manejando un update:", exc_info=context.error)
    
    # Notify user about the error if in dev mode
    if DEV_MODE and isinstance(update, Update) and update.effective_message:
        error_msg = f"❌ <b>Error de Sistema</b>\n\n<code>{str(context.error)}</code>"
        try:
            await update.effective_message.reply_text(error_msg, parse_mode="HTML")
        except:
            pass # Si no se puede enviar mensaje, al menos ya está en el log


from telegram import BotCommand

async def post_init(application):
    """
    Registra los comandos en el menú nativo de Telegram (BotFather style).
    """
    await application.bot.set_my_commands([
        BotCommand("start",     "Bienvenida y panel principal"),
        BotCommand("vincular",  "Conectar tu cuenta de SmartTrack"),
        BotCommand("resumen",   "Tu resumen diario de hoy"),
        BotCommand("tareas",    "Lista de tus tareas activas"),
        BotCommand("nuevo",     "Crear un nuevo proyecto o tarea"),
        BotCommand("redactar",  "Asistente de redacción con IA"),
        BotCommand("enfocar",   "Iniciar modo enfoque (Pomodoro)"),
        BotCommand("ayudame",   "Modo anti-parálisis"),
        BotCommand("recuperar", "Recuperar contraseña"),
        BotCommand("parar",     "Detener modo enfoque"),
        BotCommand("ayuda",     "Mostrar panel de control"),
    ])

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from natural_language_handler import get_main_inline_keyboard
    nombre = update.effective_user.first_name
    texto = (
        f"👋 ¡Hola, {nombre}! Bienvenido a <b>SmartTrack</b>.\n\n"
        "Soy tu asistente personal de productividad. Te ayudaré a organizar tu trabajo "
        "y mantener el foco en lo importante.\n\n"
        "👇 <b>¿Qué quieres hacer hoy?</b>"
    )
    await update.effective_message.reply_text(texto, parse_mode="HTML", reply_markup=get_main_inline_keyboard())

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from natural_language_handler import get_main_inline_keyboard
    texto = (
        "🤖 <b>Panel de Control SmartTrack</b>\n\n"
        "Puedes usar los botones de abajo o escribirme en lenguaje natural lo que necesites."
    )
    await update.effective_message.reply_text(texto, parse_mode="HTML", reply_markup=get_main_inline_keyboard())

async def post_shutdown(application):
    """Cierra el cliente HTTP singleton limpiamente al detener el bot (Perf 1)."""
    from http_client import close_http_client
    await close_http_client()
    logger.info("Cliente HTTP cerrado correctamente.")

if __name__ == '__main__':
    if not TOKEN or TOKEN == "your_telegram_bot_token_here":
        print("Error: TELEGRAM_BOT_TOKEN no configurado en .env")
    else:
        application = ApplicationBuilder().token(TOKEN)\
            .post_init(post_init)\
            .post_shutdown(post_shutdown)\
            .build()
        application.add_error_handler(error_handler)
        from natural_language_handler import inline_button_handler

        # Registro de comandos y handlers
        application.add_handler(CommandHandler('start', start))
        application.add_handler(CommandHandler('ayuda', help_command))
        # FIX Problema 1: vincular_handler ya es ConversationHandler con su propio
        # entry_point CommandHandler('vincular'). No duplicar con otro CommandHandler.
        application.add_handler(vincular_handler)
        application.add_handler(redactar_handler)
        # project_conv_handler debe ir ANTES del inline_button_handler para capturar
        # btn_new_proj y btn_new_task antes que el handler genérico ^btn_
        application.add_handler(project_conv_handler)
        application.add_handler(anti_paralysis_handler)
        application.add_handler(recovery_handler)
        application.add_handler(team_link_handler)
        application.add_handler(focus_handler)
        application.add_handler(stop_focus_handler)
        application.add_handler(CommandHandler('resumen', get_resumen))
        
        # FIX Problema 4: Agregar comandos faltantes que están en el menú pero no tenían handler
        application.add_handler(CommandHandler('tareas', lambda u, c: handle_get_tasks(u, c, {})))
        application.add_handler(CommandHandler('nuevo', lambda u, c: start_project_creation(u, c, {})))
        
        # Handlers de botones e IA
        application.add_handler(inline_button_handler)
        application.add_handler(natural_language_handler)

        setup_scheduler(application)
        print("SmartTrack Bot iniciado con menú nativo...")
        application.run_polling()
