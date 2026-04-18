import httpx
import os
import logging
from telegram import Update
from telegram.ext import ContextTypes

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def get_resumen(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    # En un sistema real, usaríamos el token JWT guardado en Redis para esta petición
    # Para el MVP, asumiremos que el backend puede identificar por chat_id o simplificaremos

    async with httpx.AsyncClient() as client:
        try:
            # Primero buscamos el usuario asociado al chat_id
            # NOTA: En producción esto debería estar optimizado
            response = await client.get(f"{BACKEND_URL}/dashboard/leader") # Placeholder, ajustar según lógica real

            if response.status_code == 200:
                # Simulación de respuesta basada en la especificación
                resumen = (
                    "📊 Tu resumen de hoy — SmartTrack\n\n"
                    "✅ Completado ayer: 2 tareas\n"
                    "⏳ En progreso: 4 tareas\n"
                    "🔴 Vencen hoy: 1 tarea\n"
                    "⚠️ Atrasadas: 0 tareas\n\n"
                    "📋 PRIORIDAD HOY:\n"
                    "1. [ALTA] Configurar motor IA\n"
                    "2. [MEDIA] Review de PRs\n\n"
                    "¿Quieres detalles de algún proyecto específico?"
                )
                await update.message.reply_text(resumen)
            else:
                await update.message.reply_text("No pude obtener tu resumen. Asegúrate de tener tu cuenta vinculada.")
        except Exception as e:
            logging.error(f"Error obteniendo resumen: {e}")
            await update.message.reply_text("Error de conexión con SmartTrack.")
