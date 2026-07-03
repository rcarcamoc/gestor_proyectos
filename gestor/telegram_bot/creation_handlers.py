import logging
import os
import re
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler, MessageHandler, filters, CommandHandler, CallbackQueryHandler
from http_client import get_http_client

# Estados para la creación guiada
AWAITING_PROJECT_DETAILS = 1
AWAITING_TASK_PROJECT = 2
AWAITING_TASK_TITLE = 3
AWAITING_TASK_PRIORITY = 4
AWAITING_TASK_START_DATE = 5
AWAITING_TASK_DEADLINE = 6
AWAITING_TASK_HOURS = 7
AWAITING_TASK_RECURRENCE = 8
AWAITING_TASK_ASSIGNEE = 9
CONFIRM_CREATION = 10

# ---------------------------------------------------------------------------
# Utilidad para limpiar entidades del LLM que contienen placeholders
# ---------------------------------------------------------------------------
_PLACEHOLDERS = {
    "nombre si aplica", "fecha si aplica", "persona a asignar si aplica",
    "estado a actualizar si aplica", "estado si aplica",
    "cantidad de horas si aplica", "skill1", "skill2",
}

def clean_entity(val):
    """Devuelve None si el valor es vacío o un placeholder del prompt."""
    if not val:
        return None
    if str(val).strip().lower() in _PLACEHOLDERS:
        return None
    return val

# ---------------------------------------------------------------------------
# Flujo guiado: Creación de Proyecto
# ---------------------------------------------------------------------------

async def start_project_creation(update: Update, context: ContextTypes.DEFAULT_TYPE, entities=None):
    """Inicia el flujo de creación de proyecto."""
    name = clean_entity(entities.get("project_name")) if entities else None
    
    if not name:
        await update.effective_message.reply_text("¡Genial! Vamos a crear un nuevo proyecto. ¿Cómo se llamará?")
        context.user_data['new_project'] = {}
        return AWAITING_PROJECT_DETAILS
    
    context.user_data['new_project'] = {
        "name": name,
        "description": None,
        "deadline": None,
    }
    
    await update.effective_message.reply_text(
        f"He detectado que quieres crear el proyecto: <b>{name}</b>.\n\n"
        f"¿Cuál es el objetivo o descripción del proyecto?",
        parse_mode='HTML'
    )
    return AWAITING_PROJECT_DETAILS

async def process_project_details(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.effective_message.text
    project = context.user_data.get('new_project', {})

    if not project.get("name"):
        project["name"] = text
        context.user_data['new_project'] = project
        await update.effective_message.reply_text("Entendido. Ahora, describe brevemente el objetivo del proyecto.")
        return AWAITING_PROJECT_DETAILS

    if not project.get("description"):
        project["description"] = text
        context.user_data['new_project'] = project
        await update.effective_message.reply_text("Perfecto. ¿Para qué fecha debería estar terminado? (Ejemplo: 2026-06-30)")
        return AWAITING_PROJECT_DETAILS

    if not re.match(r'^\d{4}-\d{2}-\d{2}$', text.strip()):
        await update.effective_message.reply_text(
            "Formato incorrecto. Usa el formato <b>AAAA-MM-DD</b>. Ejemplo: <code>2026-06-30</code>",
            parse_mode='HTML'
        )
        return AWAITING_PROJECT_DETAILS
    project["deadline"] = text.strip()
    context.user_data['new_project'] = project

    summary = (
        f"📋 <b>Resumen del Proyecto</b>\n\n"
        f"Nombre: {project['name']}\n"
        f"Descripción: {project['description']}\n"
        f"Fecha Fin: {project['deadline']}\n\n"
        f"¿Confirmas la creación?"
    )
    
    keyboard = [
        [InlineKeyboardButton("✅ Confirmar", callback_data="conf_proj_yes"),
         InlineKeyboardButton("❌ Cancelar", callback_data="conf_proj_no")]
    ]
    await update.effective_message.reply_text(summary, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return CONFIRM_CREATION

async def handle_project_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "conf_proj_yes":
        project = context.user_data.get('new_project')
        chat_id = update.effective_chat.id
        
        client = get_http_client()
        try:
            res = await client.post("/telegram/create-project", json={
                "telegram_chat_id": chat_id,
                "name": project['name'],
                "description": project['description'],
                "deadline": project['deadline']
            })
            if res.status_code == 200:
                await query.edit_message_text(f"✅ ¡Proyecto '{project['name']}' creado con éxito!")
            else:
                detail = res.json().get("detail", "Error desconocido")
                await query.edit_message_text(f"❌ Error al crear el proyecto: {detail}")
        except Exception as e:
            await query.edit_message_text(f"❌ Error de conexión: {e}")
    else:
        await query.edit_message_text("Operación cancelada.")
    
    context.user_data.pop('new_project', None)
    return ConversationHandler.END

# ---------------------------------------------------------------------------
# Flujo guiado: Creación de Tarea
# ---------------------------------------------------------------------------

async def start_task_creation(update: Update, context: ContextTypes.DEFAULT_TYPE, entities=None):
    """Inicia el flujo de creación de tarea."""
    chat_id = update.effective_chat.id
    task_name = clean_entity(entities.get("task_name")) if entities else None
    context.user_data['new_task'] = {"name": task_name} if task_name else {}
    
    client = get_http_client()
    try:
        res = await client.get("/telegram/get-projects", params={"chat_id": chat_id})
        projects = res.json() if res.status_code == 200 else []
    except Exception:
        projects = []

    if not projects:
        await update.effective_message.reply_text("No tienes proyectos activos. Crea uno primero.")
        return ConversationHandler.END

    keyboard = [
        [InlineKeyboardButton(p['name'], callback_data=f"sel_proj_{p['id']}")]
        for p in projects
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    msg = "¿A qué proyecto pertenece esta tarea? Selecciona uno de la lista:"
    if update.callback_query:
        await update.callback_query.edit_message_text(msg, reply_markup=reply_markup)
    else:
        await update.effective_message.reply_text(msg, reply_markup=reply_markup)
        
    return AWAITING_TASK_PROJECT

async def handle_project_selection_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    project_id = int(query.data.replace("sel_proj_", ""))
    
    chat_id = update.effective_chat.id
    task = context.user_data.get('new_task', {})
    
    client = get_http_client()
    res = await client.get("/telegram/get-projects", params={"chat_id": chat_id})
    projects = res.json() if res.status_code == 200 else []
    match = next((p for p in projects if p['id'] == project_id), None)
    
    if match:
        task["project_id"] = match["id"]
        task["project_name"] = match["name"]
        context.user_data['new_task'] = task
        
        if not task.get("name"):
            await query.edit_message_text(f"Entendido, para el proyecto <b>{match['name']}</b>. ¿Cuál es el nombre de la tarea?", parse_mode='HTML')
            return AWAITING_TASK_TITLE
        else:
            kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("Baja", callback_data="prio_Low"),
                 InlineKeyboardButton("Media", callback_data="prio_Medium")],
                [InlineKeyboardButton("Alta", callback_data="prio_High"),
                 InlineKeyboardButton("Crítica", callback_data="prio_Critical")]
            ])
            await query.edit_message_text(f"Proyecto: <b>{match['name']}</b>\nTarea: <b>{task['name']}</b>\n\n¿Cuál es la prioridad?", parse_mode='HTML', reply_markup=kb)
            return AWAITING_TASK_PRIORITY
    else:
        await query.edit_message_text("Error al seleccionar proyecto. Intenta de nuevo.")
        return AWAITING_TASK_PROJECT

async def process_task_details(update: Update, context: ContextTypes.DEFAULT_TYPE):
    task = context.user_data.get('new_task', {})
    chat_id = update.effective_chat.id
    from datetime import datetime, timedelta

    query = update.callback_query
    text = update.message.text if update.message else None
    data = query.data if query else None

    def get_date_keyboard(prefix="date_"):
        today = datetime.now().strftime("%Y-%m-%d")
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("Hoy", callback_data=f"{prefix}{today}"),
             InlineKeyboardButton("Mañana", callback_data=f"{prefix}{tomorrow}")],
            [InlineKeyboardButton("Próxima Semana", callback_data=f"{prefix}{next_week}"),
             InlineKeyboardButton("Omitir", callback_data=f"{prefix}skip")]
        ])

    if "project_id" in task and not task.get("name"):
        task["name"] = text
        context.user_data['new_task'] = task
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("Baja", callback_data="prio_Low"),
             InlineKeyboardButton("Media", callback_data="prio_Medium")],
            [InlineKeyboardButton("Alta", callback_data="prio_High"),
             InlineKeyboardButton("Crítica", callback_data="prio_Critical")]
        ])
        await update.message.reply_text("¿Cuál es la prioridad?", reply_markup=kb)
        return AWAITING_TASK_PRIORITY

    if data and data.startswith("prio_"):
        await query.answer()
        task["priority"] = data.replace("prio_", "")
        context.user_data['new_task'] = task
        await query.edit_message_text("¿Cuándo debería <b>iniciar</b>? (YYYY-MM-DD o usa los botones)", parse_mode='HTML', reply_markup=get_date_keyboard("sdate_"))
        return AWAITING_TASK_START_DATE

    if (data and data.startswith("sdate_")) or (text and not task.get("start_date")):
        val = data.replace("sdate_", "") if data else text
        if val != "skip":
            task["start_date"] = val
        else:
            task["start_date"] = None
        
        context.user_data['new_task'] = task
        msg = "¿Cuál es la <b>fecha límite</b> (Deadline)? (YYYY-MM-DD o usa los botones)"
        try:
            if query:
                await query.edit_message_text(msg, parse_mode='HTML', reply_markup=get_date_keyboard("ddate_"))
            else:
                await update.message.reply_text(msg, parse_mode='HTML', reply_markup=get_date_keyboard("ddate_"))
        except Exception:
            pass
        return AWAITING_TASK_DEADLINE

    if (data and data.startswith("ddate_")) or (text and not task.get("deadline")):
        val = data.replace("ddate_", "") if data else text
        if val != "skip":
            task["deadline"] = val
        else:
            task["deadline"] = None
            
        context.user_data['new_task'] = task
        msg = "¿Cuántas horas estimadas tomará? (Escribe el número o 'saltar')"
        try:
            if query:
                await query.edit_message_text(msg)
            else:
                await update.message.reply_text(msg)
        except Exception:
            pass
        return AWAITING_TASK_HOURS

    if text and "estimated_hours" not in task:
        if text.lower() != "saltar":
            try:
                task["estimated_hours"] = float(text)
            except:
                await update.message.reply_text("Por favor ingresa un número válido o escribe 'saltar'.")
                return AWAITING_TASK_HOURS
        else:
            task["estimated_hours"] = None
            
        context.user_data['new_task'] = task
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("Puntual", callback_data="recur_puntual"),
             InlineKeyboardButton("Diaria", callback_data="recur_diaria")],
            [InlineKeyboardButton("Semanal", callback_data="recur_semanal"),
             InlineKeyboardButton("Mensual", callback_data="recur_mensual")]
        ])
        await update.message.reply_text("¿Cuál es la frecuencia?", reply_markup=kb)
        return AWAITING_TASK_RECURRENCE

    if data and data.startswith("recur_"):
        await query.answer()
        task["recurrence"] = data.replace("recur_", "")
        context.user_data['new_task'] = task
        
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("Asignármela a mí", callback_data="assign_self")],
            [InlineKeyboardButton("Dejar sin asignar", callback_data="assign_none")]
        ])
        await query.edit_message_text("¿A quién deseas asignar esta tarea?", reply_markup=kb)
        return AWAITING_TASK_ASSIGNEE

    if data and data.startswith("assign_"):
        await query.answer()
        task["assignee"] = data.replace("assign_", "")
        context.user_data['new_task'] = task
        
        resumen = (
            "📋 <b>Resumen de la Tarea</b>\n\n"
            f"📂 Proyecto: {task.get('project_name')}\n"
            f"📌 Título: {task.get('name')}\n"
            f"🔥 Prioridad: {task.get('priority')}\n"
            f"📅 Inicio: {task.get('start_date') or 'N/A'}\n"
            f"🏁 Límite: {task.get('deadline') or 'N/A'}\n"
            f"⏳ Horas: {task.get('estimated_hours') or 'N/A'}\n"
            f"🔄 Recurrencia: {task.get('recurrence')}\n"
            f"👤 Asignado: {'Yo mismo' if task.get('assignee')=='self' else 'Nadie'}\n\n"
            "¿Confirmas la creación?"
        )
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Confirmar", callback_data="conf_task_yes"),
             InlineKeyboardButton("❌ Cancelar",  callback_data="conf_task_no")]
        ])
        await query.edit_message_text(resumen, parse_mode='HTML', reply_markup=kb)
        return CONFIRM_CREATION

    return AWAITING_TASK_PROJECT

async def handle_task_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "conf_task_yes":
        task = context.user_data.get('new_task')
        chat_id = update.effective_chat.id
        client = get_http_client()
        try:
            res = await client.post("/telegram/create-task", json={
                "telegram_chat_id": chat_id,
                "project_id": task['project_id'],
                "name": task['name'],
                "priority": task.get('priority', 'Medium'),
                "deadline": task.get('deadline'),
                "start_date": task.get('start_date'),
                "estimated_hours": task.get('estimated_hours'),
                "recurrence_type": task.get('recurrence', 'puntual'),
                "status": "Pending",
                "assignee_id": None
            })
            if res.status_code == 200:
                await query.edit_message_text(f"✅ Tarea '{task['name']}' creada con éxito.")
            else:
                detail = res.json().get("detail", "Error desconocido")
                await query.edit_message_text(f"❌ Error al crear la tarea: {detail}")
        except Exception as e:
            await query.edit_message_text(f"❌ Error de conexión: {e}")
    else:
        await query.edit_message_text("Operación cancelada.")
    
    context.user_data.pop('new_task', None)
    return ConversationHandler.END

# ---------------------------------------------------------------------------
# Definición del ConversationHandler
# ---------------------------------------------------------------------------

project_conv_handler = ConversationHandler(
    entry_points=[
        CommandHandler('nuevo_proyecto', start_project_creation),
        CommandHandler('nueva_tarea',    start_task_creation),
        CallbackQueryHandler(start_project_creation, pattern="^btn_new_proj$"),
        CallbackQueryHandler(start_task_creation,    pattern="^btn_new_task$"),
    ],
    states={
        AWAITING_PROJECT_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_project_details)],
        AWAITING_TASK_PROJECT: [
            CallbackQueryHandler(handle_project_selection_callback, pattern="^sel_proj_"),
            MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)
        ],
        AWAITING_TASK_TITLE:      [MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)],
        AWAITING_TASK_PRIORITY:   [CallbackQueryHandler(process_task_details, pattern="^prio_")],
        AWAITING_TASK_START_DATE: [
            CallbackQueryHandler(process_task_details, pattern="^sdate_"),
            MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)
        ],
        AWAITING_TASK_DEADLINE:   [
            CallbackQueryHandler(process_task_details, pattern="^ddate_"),
            MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)
        ],
        AWAITING_TASK_HOURS:      [MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)],
        AWAITING_TASK_RECURRENCE: [CallbackQueryHandler(process_task_details, pattern="^recur_")],
        AWAITING_TASK_ASSIGNEE:   [
            CallbackQueryHandler(process_task_details, pattern="^assign_"),
            MessageHandler(filters.TEXT & ~filters.COMMAND, process_task_details)
        ],
        CONFIRM_CREATION: [
            CallbackQueryHandler(handle_project_confirmation, pattern="^conf_proj_"),
            CallbackQueryHandler(handle_task_confirmation,    pattern="^conf_task_"),
        ],
    },
    fallbacks=[
        CommandHandler('cancelar', lambda u, c: (
            c.user_data.pop('new_project', None),
            c.user_data.pop('new_task', None),
            ConversationHandler.END
        )[-1])
    ],
    per_message=False,
)
