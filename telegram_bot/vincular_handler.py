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
    await update.message.reply_text(
        "Por favor, ingresa el código de vinculación que aparece en tu panel de SmartTrack "
        "(ve a smarttrack.app/vincular)."
    )
    return VINCULAR

async def process_token(update: Update, context: ContextTypes.DEFAULT_TYPE):
    token = update.message.text.strip().upper()
    chat_id = update.effective_chat.id

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/telegram/link",
                json={"token": token, "telegram_chat_id": chat_id}
            )

            if response.status_code == 200:
                data = response.json()
                user_name = data.get("user_full_name", "Usuario")

                # Guardar el ID de chat en una estructura que el bot reconozca como "vinculado"
                # En un flujo más robusto, el backend devolvería un token de larga duración para el bot
                session.set_user_token(chat_id, "linked_session_token")

                await update.message.reply_text(
                    f"¡Listo! ✅ Tu cuenta ha sido vinculada correctamente, {user_name}.\n"
                    "Ahora puedes usar todos los comandos del bot."
                )
            else:
                await update.message.reply_text(
                    "❌ El código es inválido o ha expirado. Por favor, genera uno nuevo en la web e intenta de nuevo."
                )
        except Exception as e:
            logging.error(f"Error vinculando cuenta: {e}")
            await update.message.reply_text("Hubo un error al conectar con el servidor. Intenta más tarde.")

    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Operación cancelada.")
    return ConversationHandler.END

vincular_handler = ConversationHandler(
    entry_points=[CommandHandler('vincular', start_vincular)],
    states={
        VINCULAR: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_token)],
    },
    fallbacks=[CommandHandler('cancel', cancel)],
)
