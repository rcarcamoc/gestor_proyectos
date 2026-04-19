import os
import httpx
import logging
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler, CommandHandler, MessageHandler, filters

AWAITING_EMAIL = 1
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def start_recovery(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Para recuperar tu contraseña, por favor dime cuál es el correo electrónico con el que te registraste en SmartTrack."
    )
    return AWAITING_EMAIL

async def process_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    email = update.message.text.strip()
    chat_id = update.effective_chat.id

    await update.message.reply_text("⏳ Verificando tu cuenta...")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BACKEND_URL}/telegram/recover-password", json={
                "telegram_chat_id": chat_id,
                "email": email
            })

            if response.status_code == 200:
                data = response.json()
                temp_password = data.get("temp_password")
                await update.message.reply_text(
                    f"✅ Tu contraseña ha sido restablecida.\n\n"
                    f"Tu nueva contraseña temporal es: `{temp_password}`\n\n"
                    f"Por favor, inicia sesión y cámbiala lo antes posible desde la configuración de tu cuenta.",
                    parse_mode="Markdown"
                )
            elif response.status_code == 404:
                await update.message.reply_text(
                    "❌ Tu cuenta de Telegram no está vinculada. No puedo restablecer la contraseña de esta forma."
                )
            elif response.status_code == 400:
                await update.message.reply_text(
                    "❌ El correo proporcionado no coincide con el de la cuenta vinculada a este Telegram."
                )
            else:
                await update.message.reply_text("Hubo un error al intentar recuperar tu contraseña. Intenta más tarde.")

        except Exception as e:
            logging.error(f"Error en recuperación: {e}")
            await update.message.reply_text("Hubo un problema de conexión con el servidor.")

    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Recuperación de contraseña cancelada.")
    return ConversationHandler.END

recovery_handler = ConversationHandler(
    entry_points=[CommandHandler('recuperar', start_recovery)],
    states={
        AWAITING_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_email)]
    },
    fallbacks=[CommandHandler('cancel', cancel)]
)
