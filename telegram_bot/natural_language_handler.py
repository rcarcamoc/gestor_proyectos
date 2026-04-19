import logging
import httpx
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler, MessageHandler, filters, CommandHandler, CallbackQueryHandler
from gemini_service import GeminiService

# Estados para la creación guiada
AWAITING_PROJECT_DETAILS = 1
AWAITING_TASK_DETAILS = 2
CONFIRM_CREATION = 3

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
gemini = GeminiService()

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Maneja mensajes de texto generales usando IA para determinar la intención.
    """
    text = update.message.text
    chat_id = update.effective_chat.id
    
    # Extraer intención con Gemini
    analysis = await gemini.extract_intent(text)
    intent = analysis.get("intent", "unknown")
    entities = analysis.get("entities", {})
    confidence = analysis.get("confidence", 0)
    
    logging.info(f"Intent detectado: {intent} (conf: {confidence})")
    
    if intent == "create_project":
        return await start_project_creation(update, context, entities)
    elif intent == "create_task":
        return await start_task_creation(update, context, entities)
    elif intent == "get_summary":
        from summary_handler import get_resumen
        return await get_resumen(update, context)
    elif intent == "write_assistant":
        from writing_handler import start_redactar
        return await start_redactar(update, context)
    elif intent == "anti_paralysis":
        from anti_paralysis_handler import start_anti_paralysis
        return await start_anti_paralysis(update, context)
    elif intent == "focus_mode":
        from focus_handler import start_focus
        return await start_focus(update, context)
    elif intent == "update_skills":
        return await handle_skills_update(update, context, entities)
    elif intent == "update_availability":
        return await handle_availability_update(update, context, entities)
    else:
        # Si no entiende, responde de forma conversacional
        prompt = (
            "Eres SmartTrack Bot. El usuario te ha dicho algo que no encaja en una acción clara. "
            "Responde de forma amable, profesional y recuérdale que puedes ayudarle a crear proyectos, "
            "tareas, resumir su día o redactar correos. Mantén la respuesta breve."
        )
        response = await gemini.generate_response(prompt, text)
        await update.message.reply_text(response)

async def start_project_creation(update: Update, context: ContextTypes.DEFAULT_TYPE, entities=None):
    """
    Inicia el flujo de creación de proyecto.
    """
    name = entities.get("project_name") if entities else None
    
    if not name or name == "nombre si aplica":
        await update.message.reply_text("¡Genial! Vamos a crear un nuevo proyecto. ¿Cómo se llamará?")
        return AWAITING_PROJECT_DETAILS
    
    context.user_data['new_project'] = {
        "name": name,
        "description": entities.get("description", "Sin descripción"),
        "deadline": entities.get("deadline", "2026-12-31") # Fallback
    }
    
    await update.message.reply_text(
        f"He detectado que quieres crear el proyecto: *{name}*.\n\n"
        f"¿Cuál es el objetivo o descripción del proyecto?",
        parse_mode='Markdown'
    )
    return AWAITING_PROJECT_DETAILS

async def process_project_details(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if 'new_project' not in context.user_data:
        context.user_data['new_project'] = {"name": text}
        await update.message.reply_text("Entendido. Ahora, describe brevemente el objetivo del proyecto.")
        return AWAITING_PROJECT_DETAILS
    
    project = context.user_data['new_project']
    if "description" not in project or project["description"] == "Sin descripción":
        project["description"] = text
        await update.message.reply_text("Perfecto. ¿Para qué fecha debería estar terminado? (Ejemplo: 2026-06-30)")
        return AWAITING_PROJECT_DETAILS
    
    # Asumimos que el último texto es la fecha
    project["deadline"] = text
    
    summary = (
        f"📋 *Resumen del Proyecto*\n\n"
        f"Nombre: {project['name']}\n"
        f"Descripción: {project['description']}\n"
        f"Fecha Fin: {project['deadline']}\n\n"
        f"¿Confirmas la creación?"
    )
    
    keyboard = [
        [InlineKeyboardButton("✅ Confirmar", callback_data="conf_proj_yes"),
         InlineKeyboardButton("❌ Cancelar", callback_data="conf_proj_no")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(summary, reply_markup=reply_markup, parse_mode='Markdown')
    return CONFIRM_CREATION

async def handle_project_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "conf_proj_yes":
        project = context.user_data.get('new_project')
        chat_id = update.effective_chat.id
        
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(f"{BACKEND_URL}/telegram/create-project", json={
                    "telegram_chat_id": chat_id,
                    "name": project['name'],
                    "description": project['description'],
                    "deadline": project['deadline']
                })
                if res.status_code == 200:
                    await query.edit_message_text(f"✅ ¡Proyecto '{project['name']}' creado con éxito!")
                else:
                    await query.edit_message_text("❌ Hubo un error al crear el proyecto en el servidor.")
            except Exception as e:
                await query.edit_message_text(f"❌ Error de conexión: {e}")
    else:
        await query.edit_message_text("Operación cancelada.")
    
    context.user_data.pop('new_project', None)
    return ConversationHandler.END

async def start_task_creation(update: Update, context: ContextTypes.DEFAULT_TYPE, entities=None):
    """
    Inicia el flujo de creación de tarea.
    """
    task_name = entities.get("task_name") if entities else None
    
    # Primero necesitamos saber a qué proyecto pertenece
    async with httpx.AsyncClient() as client:
        try:
            # Obtener chat_id para buscar sus proyectos
            chat_id = update.effective_chat.id
            res = await client.get(f"{BACKEND_URL}/dashboard/member?chat_id={chat_id}") # Ajustar si es necesario
            # Simplificación: pedimos el nombre del proyecto o mostramos lista
            await update.message.reply_text("¿A qué proyecto pertenece esta tarea? (Escribe el nombre del proyecto)")
            context.user_data['new_task'] = {"name": task_name}
            return AWAITING_TASK_DETAILS
        except Exception as e:
            await update.message.reply_text("Error al obtener tus proyectos.")
            return ConversationHandler.END

async def process_task_details(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    task = context.user_data.get('new_task', {})
    
    if "project_id" not in task:
        # Aquí buscaríamos el project_id por nombre (simplificado por ahora)
        # En un MVP real, mostraríamos botones inline con los proyectos
        task["project_id"] = 1 # Placeholder: asumimos el primer proyecto por ahora
        task["project_name"] = text
        await update.message.reply_text(f"Entendido, para el proyecto '{text}'. ¿Cuál es el nombre de la tarea?")
        return AWAITING_TASK_DETAILS
    
    if "name" not in task or not task["name"]:
        task["name"] = text
        await update.message.reply_text("¿Cuál es la fecha de vencimiento? (Ejemplo: 2026-05-15)")
        return AWAITING_TASK_DETAILS
    
    task["deadline"] = text
    
    summary = (
        f"✅ *Confirmar Tarea*\n\n"
        f"Proyecto: {task['project_name']}\n"
        f"Tarea: {task['name']}\n"
        f"Vence: {task['deadline']}\n\n"
        "¿La creo?"
    )
    
    keyboard = [[InlineKeyboardButton("Sí", callback_data="conf_task_yes"),
                 InlineKeyboardButton("No", callback_data="conf_task_no")]]
    await update.message.reply_text(summary, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return CONFIRM_CREATION

async def handle_task_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "conf_task_yes":
        task = context.user_data.get('new_task')
        chat_id = update.effective_chat.id
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{BACKEND_URL}/telegram/create-task", json={
                "telegram_chat_id": chat_id,
                "project_id": task["project_id"],
                "name": task["name"],
                "deadline": task["deadline"]
            })
            if res.status_code == 200:
                await query.edit_message_text(f"✅ Tarea '{task['name']}' creada.")
            else:
                await query.edit_message_text("❌ Error al crear la tarea.")
    else:
        await query.edit_message_text("Operación cancelada.")
    
    context.user_data.pop('new_task', None)
    return ConversationHandler.END

async def handle_skills_update(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    skills = entities.get("skills", [])
    if not skills:
        await update.message.reply_text("No he detectado qué skills quieres agregar. ¿Podrías repetirlo?")
        return
    
    chat_id = update.effective_chat.id
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"{BACKEND_URL}/telegram/update-skills", json={
                "telegram_chat_id": chat_id,
                "skills": skills
            })
            if res.status_code == 200:
                skills_str = ", ".join(skills)
                await update.message.reply_text(f"✅ ¡Genial! He añadido estos skills a tu perfil: *{skills_str}*", parse_mode='Markdown')
            else:
                await update.message.reply_text("Hubo un problema actualizando tus skills.")
        except Exception as e:
            await update.message.reply_text(f"Error de conexión: {e}")

async def handle_availability_update(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    hours = entities.get("hours_per_day")
    if not hours:
        await update.message.reply_text("¿Cuántas horas al día quieres configurar?")
        return
    
    chat_id = update.effective_chat.id
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"{BACKEND_URL}/telegram/update-availability", json={
                "telegram_chat_id": chat_id,
                "hours_per_day": float(hours)
            })
            if res.status_code == 200:
                await update.message.reply_text(f"✅ He actualizado tu disponibilidad a *{hours} horas* al día.", parse_mode='Markdown')
            else:
                await update.message.reply_text("Hubo un problema actualizando tu disponibilidad.")
        except Exception as e:
            await update.message.reply_text(f"Error de conexión: {e}")

# Definición del Handler para exportar
natural_language_handler = MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message)

project_conv_handler = ConversationHandler(
    entry_points=[
        CommandHandler('nuevo_proyecto', start_project_creation),
        CommandHandler('nueva_tarea', start_task_creation)
    ],
    states={
        AWAITING_PROJECT_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_project_details)],
        AWAITING_TASK_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)],
        CONFIRM_CREATION: [
            CallbackQueryHandler(handle_project_confirmation, pattern="^conf_proj_"),
            CallbackQueryHandler(handle_task_confirmation, pattern="^conf_task_")
        ],
    },
    fallbacks=[CommandHandler('cancelar', lambda u, c: ConversationHandler.END)]
)
