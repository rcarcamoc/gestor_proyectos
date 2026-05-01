"""
Resumen diario del usuario.

Perf 1: singleton HTTP client.
Perf 2: singleton Gemini.
Perf 3: cachea datos de tareas 60s.
"""
import logging
from telegram import Update
from telegram.ext import ContextTypes
from http_client import get_http_client
from session_service import RedisSession

session = RedisSession()


async def get_resumen(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    client = get_http_client()
    try:
        # Perf 3: usar caché si existe (TTL 60s — razonable para un resumen)
        cache_key = f"tasks:{chat_id}"
        tasks_data = session.get_cached(cache_key)

        if tasks_data is None:
            # BUG 13 FIX: llamar directamente por chat_id en lugar de descargar todos
            res = await client.get("/telegram/get-tasks", params={"chat_id": chat_id})
            if res.status_code == 404:
                await update.effective_message.reply_text(
                    "⚠️ Tu cuenta no está vinculada. Usa /vincular para comenzar."
                )
                return
            if res.status_code != 200:
                await update.effective_message.reply_text("Error al verificar tu cuenta.")
                return

            tasks_data = res.json()
            session.set_cached(cache_key, tasks_data, ex=60)

        # AGREGAR ANTES del client.post("/telegram/completion"):
        if not tasks_data:
            await update.effective_message.reply_text(
                "📊 <b>Tu resumen de hoy</b>\n\nNo tienes tareas registradas aún.\nUsa ➕ <b>Nuevo</b> para crear tu primera tarea.",
                parse_mode="HTML",
            )
            return

        res = await client.post("/telegram/completion", json={
            "system_prompt": "Eres SmartTrack Bot. Genera un resumen ejecutivo de las tareas del usuario para hoy. Sé motivador, profesional y usa emojis. Responde en HTML de Telegram.",
            "user_prompt": f"Usa los datos proporcionados para listar: tareas pendientes, tareas atrasadas y prioridades. Datos: {str(tasks_data)}"
        })
        if res.status_code == 200:
            resumen_ai = res.json().get("response", "No se pudo generar el resumen.")
        else:
            resumen_ai = "Error al conectar con la IA central."

        await update.effective_message.reply_text(
            f"📊 <b>Tu resumen de hoy</b>\n\n{resumen_ai}",
            parse_mode="HTML",
        )

    except Exception as e:
        logging.error(f"Error obteniendo resumen: {e}")
        await update.effective_message.reply_text("Lo siento, hubo un error al generar tu resumen.")
