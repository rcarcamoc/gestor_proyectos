import httpx
import os
import logging
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def vincular_equipo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Comando /vincular_equipo [CODIGO]
    Debe ejecutarse dentro del grupo de Telegram del equipo.
    """
    if update.effective_chat.type == "private":
        await update.message.reply_text("Este comando debe ejecutarse dentro de un grupo de Telegram.")
        return

    if not context.args:
        await update.message.reply_text("Uso: /vincular_equipo [CÓDIGO_DE_EQUIPO]\n\nEncuentra el código en la configuración de tu equipo en la web.")
        return

    link_code = context.args[0].upper()
    chat_id = update.effective_chat.id

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/telegram/team-link",
                json={"link_code": link_code, "telegram_chat_id": chat_id}
            )

            if response.status_code == 200:
                data = response.json()
                team_name = data.get("team_name", "el equipo")
                await update.message.reply_text(
                    f"¡Excelente! ✅ Este grupo de Telegram ha sido vinculado correctamente al equipo: *{team_name}*.\n\n"
                    "A partir de ahora, enviaré notificaciones importantes de proyectos y tareas aquí.",
                    parse_mode="Markdown"
                )
            else:
                await update.message.reply_text("❌ Código de equipo inválido. Por favor verifica el código en el panel de SmartTrack.")
        except Exception as e:
            logging.error(f"Error vinculando equipo: {e}")
            await update.message.reply_text("Hubo un error al conectar con el servidor. Intenta más tarde.")

team_link_handler = CommandHandler('vincular_equipo', vincular_equipo)
