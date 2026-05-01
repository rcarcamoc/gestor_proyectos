import os
import httpx
import logging
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler, CommandHandler, MessageHandler, filters

AWAITING_EMAIL = 1
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def start_recovery(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text(
        "Para recuperar tu contraseña, por favor dime cuál es el correo electrónico con el que te registraste en SmartTrack."
    )
    return AWAITING_EMAIL

async def process_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    email = update.message.text.strip()
    chat_id = update.effective_chat.id

    await update.effective_message.reply_text("⏳ Verificando tu cuenta...")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BACKEND_URL}/telegram/recover-password", json={
                "telegram_chat_id": chat_id,
                "email": email
            })

            if response.status_code == 200:
                data = response.json()
                # BUG 21 FIX: verificar si el backend realmente envió el mensaje.
                # Si message_sent=False, significa que TELEGRAM_BOT_TOKEN no estaba
                # configurado en el backend y el mensaje nunca llegó.
                if data.get("message_sent", True):
                    await update.effective_message.reply_text(
                        "✅ Proceso completado.\n\n"
                        "Acabas de recibir un mensaje directo con tu contraseña temporal. "
                        "Revísalo en este mismo chat y úsala para iniciar sesión.\n\n"
                        "⚠️ Por seguridad, cámbiala desde la configuración de tu cuenta lo antes posible.",
                    )
                else:
                    await update.effective_message.reply_text(
                        "✅ Contraseña restablecida.\n\n"
                        "⚠️ No se pudo enviar la contraseña por Telegram. "
                        "Contacta a tu administrador para obtenerla de forma segura.",
                    )
            elif response.status_code == 404:
                await update.effective_message.reply_text(
                    "❌ Tu cuenta de Telegram no está vinculada. No puedo restablecer la contraseña de esta forma."
                )
            elif response.status_code == 400:
                await update.effective_message.reply_text(
                    "❌ El correo proporcionado no coincide con el de la cuenta vinculada a este Telegram."
                )
            else:
                await update.effective_message.reply_text("Hubo un error al intentar recuperar tu contraseña. Intenta más tarde.")

        except Exception as e:
            logging.error(f"Error en recuperación: {e}")
            await update.effective_message.reply_text("Hubo un problema de conexión con el servidor.")

    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Recuperación de contraseña cancelada.")
    return ConversationHandler.END

recovery_handler = ConversationHandler(
    entry_points=[CommandHandler('recuperar', start_recovery)],
    states={
        AWAITING_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_email)]
    },
    fallbacks=[CommandHandler('cancel', cancel)]
)
