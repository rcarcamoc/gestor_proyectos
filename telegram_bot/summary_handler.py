import httpx
import os
import logging
from telegram import Update
from telegram.ext import ContextTypes

from gemini_service import GeminiService

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
gemini = GeminiService()

async def get_resumen(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    async with httpx.AsyncClient() as client:
        try:
            # 1. Obtener la cuenta vinculada para saber el user_id
            acc_res = await client.get(f"{BACKEND_URL}/telegram/linked-accounts")
            if acc_res.status_code != 200:
                await update.message.reply_text("Error al verificar tu cuenta.")
                return

            accounts = acc_res.json()
            user_id = next((a['user_id'] for a in accounts if a['telegram_chat_id'] == chat_id), None)

            if not user_id:
                await update.message.reply_text("⚠️ Tu cuenta no está vinculada. Usa /vincular para comenzar.")
                return

            # 2. Obtener datos reales del dashboard
            dash_res = await client.get(f"{BACKEND_URL}/dashboard/member?user_id={user_id}")
            if dash_res.status_code != 200:
                await update.message.reply_text("No pude obtener tus datos de SmartTrack.")
                return

            data = dash_res.json()

            # 3. Usar Gemini para sintetizar el resumen
            prompt = (
                "Eres SmartTrack Bot. Genera un resumen ejecutivo de las tareas del usuario para hoy. "
                "Usa los datos proporcionados para listar: tareas de hoy, tareas atrasadas y carga proyectada. "
                "Sé motivador, profesional y usa emojis. Responde en Markdown."
            )
            
            resumen_ai = await gemini.generate_response(prompt, str(data))
            
            await update.message.reply_text(
                f"📊 *Tu resumen de hoy*\n\n{resumen_ai}",
                parse_mode='Markdown'
            )

        except Exception as e:
            logging.error(f"Error obteniendo resumen: {e}")
            await update.message.reply_text("Lo siento, hubo un error al generar tu resumen.")
