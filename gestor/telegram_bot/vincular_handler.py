import httpx
import os
import logging
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler, CommandHandler, MessageHandler, filters
from session_service import RedisSession

VINCULAR = 1
session = RedisSession()
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def start_vincular(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text(
        "Por favor, ingresa el código de vinculación que aparece en tu panel de SmartTrack "
        "(ve a smarttrack.app/vincular)."
    )
    return VINCULAR

# BUG 10 FIX: alias para que pueda ser llamado desde botones inline / intents de IA.
# No puede iniciar el ConversationHandler directamente (eso lo hace /vincular),
# por lo que envía instrucciones claras al usuario.
async def handle_vincular(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text(
        "🔗 Para vincular tu cuenta escribe el comando /vincular "
        "y luego ingresa el código de 6 dígitos que ves en tu panel de SmartTrack."
    )

async def process_token(update: Update, context: ContextTypes.DEFAULT_TYPE):
    token = update.message.text.strip().upper()
    chat_id = update.effective_chat.id

    async with httpx.AsyncClient() as client:
        try:
            url = f"{BACKEND_URL}/telegram/link"
            logging.info(f"Intentando vincular en: {url}")
            
            response = await client.post(
                url,
                json={"token": token, "telegram_chat_id": chat_id},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                user_name = data.get("user_full_name", "Usuario")
                session.set_user_token(chat_id, "linked_session_token")

                await update.effective_message.reply_text(
                    f"¡Listo! ✅ Tu cuenta ha sido vinculada correctamente, {user_name}.\n"
                    "Ahora puedes usar todos los comandos del bot."
                )
            else:
                detail = response.json().get('detail', 'Código inválido')
                await update.effective_message.reply_text(
                    f"❌ Error: {detail}. Por favor, genera uno nuevo en la web e intenta de nuevo."
                )
        except httpx.ConnectError:
            logging.error(f"Error de conexión: No se pudo alcanzar el backend en {BACKEND_URL}")
            await update.effective_message.reply_text(
                "⚠️ Error de comunicación: El bot no pudo contactar al servidor central.\n"
                "Verifica que BACKEND_URL en el .env sea http://backend:8000"
            )
        except Exception as e:
            logging.error(f"Error inesperado vinculando cuenta: {e}")
            await update.effective_message.reply_text(f"Hubo un error inesperado: {str(e)}")

    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Operación cancelada.")
    return ConversationHandler.END

vincular_handler = ConversationHandler(
    entry_points=[CommandHandler('vincular', start_vincular)],
    states={
        VINCULAR: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_token)],
    },
    fallbacks=[CommandHandler('cancel', cancel)],
)
