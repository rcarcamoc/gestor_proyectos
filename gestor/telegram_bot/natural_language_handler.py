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

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

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
# Handler principal de texto (detección de intent por IA)
# ---------------------------------------------------------------------------

async def send_log_to_backend(chat_id: int, user_message: str, intent: str, bot_response: str = None):
    from http_client import get_http_client
    import asyncio
    client = get_http_client()
    try:
        # Fuego y olvido
        asyncio.create_task(client.post("/telegram/log-conversation", json={
            "telegram_chat_id": chat_id,
            "user_message": user_message,
            "intent_detected": intent,
            "bot_response": bot_response
        }))
    except Exception as e:
        logging.error(f"Error despachando log: {e}")

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Maneja mensajes de texto generales usando IA para determinar la intención.
    Perf 7: pre-filtro de palabras clave comunes para evitar llamadas innecesarias a Gemini.
    """
    text = update.message.text
    chat_id = update.effective_chat.id
    text_lower = text.lower().strip()

    # 1. VERIFICAR ESTADOS ACTIVOS
    if 'new_project' in context.user_data:
        logging.info(f"Usuario en flujo de PROYECTO. Procesando: {text}")
        return await process_project_details(update, context)

    if 'new_task' in context.user_data:
        logging.info(f"Usuario en flujo de TAREA. Procesando: {text}")
        return await process_task_details(update, context)

    # ── Construir contexto del usuario ──
    from context_builder import build_user_context
    user_ctx = await build_user_context(chat_id)

    # ── Si no está vinculado, redirigir ──
    if not user_ctx["is_linked"]:
        await update.effective_message.reply_text(
            "Para usar SmartTrack necesitas vincular tu cuenta primero. Usa /vincular.",
            reply_markup=get_main_inline_keyboard()
        )
        return

    # ── PERF 7: Atajos directos sin pasar por Gemini ──
    _DIRECT = {
        ("mis tareas", "ver tareas", "tareas pendientes", "que tareas tengo", "qué tareas tengo"): "get_tasks",
        ("mis proyectos", "ver proyectos", "proyectos activos", "que proyectos tengo", "qué proyectos tengo"): "get_projects",
        ("resumen", "mi resumen", "resumen del día", "como voy", "cómo voy",
         "que tengo que hacer", "qué tengo que hacer", "que debo hacer hoy",
         "que hay para hoy", "qué hay para hoy", "tareas de hoy"): "get_summary",
        ("nuevo proyecto", "crear proyecto", "quiero crear un proyecto"): "create_project",
        ("nueva tarea", "crear tarea", "quiero crear una tarea"): "create_task",
    }
    for keywords, shortcut_intent in _DIRECT.items():
        if any(kw in text_lower for kw in keywords):
            logging.info(f"Shortcut directo detectado: {shortcut_intent}")
            intent, entities, confidence = shortcut_intent, {}, 1.0
            break
    else:
        # ── SIN ATAJO → ENVIAR AL MOTOR CENTRAL (BACKEND) ──
        await context.bot.send_chat_action(chat_id=chat_id, action='typing')
        from http_client import get_http_client
        client = get_http_client()
        try:
            res = await client.post("/telegram/chat", json={
                "telegram_chat_id": chat_id,
                "message": text
            })
            if res.status_code == 200:
                data = res.json()
                bot_reply = data.get("response", "No recibí respuesta clara del sistema.")
                await update.effective_message.reply_text(bot_reply, parse_mode='HTML', reply_markup=get_main_inline_keyboard())
            else:
                logging.error(f"Error del backend: {res.status_code} - {res.text}")
                await update.effective_message.reply_text("Tengo un problema técnico comunicándome con el servidor central.", reply_markup=get_main_inline_keyboard())
        except Exception as e:
            logging.error(f"Error en proxy a backend: {e}")
            await update.effective_message.reply_text("El motor principal está temporalmente inactivo.", reply_markup=get_main_inline_keyboard())
        
        return # Termina la ejecución para mensajes generales

    # Si era un atajo, continuamos con el handler local
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
    elif intent == "stop_focus":
        from focus_handler import stop_focus
        return await stop_focus(update, context)
    elif intent == "update_skills":
        return await handle_skills_update(update, context, entities)
    elif intent == "update_availability":
        return await handle_availability_update(update, context, entities)
    elif intent == "link_account":
        from vincular_handler import handle_vincular
        return await handle_vincular(update, context)
    elif intent == "recover_password":
        from recovery_handler import start_recovery
        return await start_recovery(update, context)
    elif intent == "get_help":
        from main import help_command
        return await help_command(update, context)
    elif intent == "get_projects":
        from info_handler import handle_get_projects
        return await handle_get_projects(update, context, entities)
    elif intent == "get_tasks":
        from info_handler import handle_get_tasks
        return await handle_get_tasks(update, context, entities)
    elif intent == "assign_task":
        from info_handler import handle_assign_task
        return await handle_assign_task(update, context, entities)
    elif intent == "update_task_status":
        from info_handler import handle_update_task_status
        return await handle_update_task_status(update, context, entities)
    elif intent == "update_deadline":
        from info_handler import handle_update_deadline
        return await handle_update_deadline(update, context, entities)
    elif intent == "get_projects_at_risk":
        from info_handler import handle_get_projects_at_risk
        return await handle_get_projects_at_risk(update, context, entities)
    elif intent == "get_project_metrics":
        from info_handler import handle_get_project_metrics
        return await handle_get_project_metrics(update, context, entities)
    elif intent == "find_available_team":
        from info_handler import handle_find_available_team
        return await handle_find_available_team(update, context, entities)
    elif intent == "get_team_summary":
        from info_handler import handle_get_team_summary
        return await handle_get_team_summary(update, context, entities)
    elif intent == "reassign_tasks":
        from info_handler import handle_reassign_tasks
        return await handle_reassign_tasks(update, context, entities)
    elif intent == "get_team_blockers":
        from info_handler import handle_get_team_blockers
        return await handle_get_team_blockers(update, context, entities)
    elif intent == "get_next_action":
        from info_handler import handle_get_next_action
        return await handle_get_next_action(update, context, entities)
    elif intent == "request_help":
        from info_handler import handle_request_help
        return await handle_request_help(update, context, entities)
    elif intent == "log_time":
        from info_handler import handle_log_time
        return await handle_log_time(update, context, entities)
    else:
        # Si por alguna razón llega un intent no manejado (de un shortcut)
        logging.warning(f"Intent de atajo no manejado: {intent}")
        await update.effective_message.reply_text("Opción de atajo no reconocida.")

def get_main_inline_keyboard():
    """
    Retorna un teclado interactivo organizado por categorías.
    """
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    keyboard = [
        [
            InlineKeyboardButton("🔗 Vincular Cuenta", callback_data="btn_vincular"),
            InlineKeyboardButton("📊 Resumen Diario",  callback_data="btn_summary"),
        ],
        [
            InlineKeyboardButton("✅ Mis Tareas",       callback_data="btn_tasks"),
            InlineKeyboardButton("➕ Nuevo",             callback_data="btn_new"),
        ],
        [
            InlineKeyboardButton("✍️ Redactar (IA)",    callback_data="btn_write"),
            InlineKeyboardButton("🍅 Modo Enfoque",     callback_data="btn_focus"),
        ],
        [
            InlineKeyboardButton("🧠 Anti-parálisis",   callback_data="btn_help_me"),
            InlineKeyboardButton("🔑 Recuperar",        callback_data="btn_recover"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)

async def handle_inline_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Maneja los clics en los botones del Panel de Control.
    """
    query = update.callback_query
    await query.answer()
    
    action = query.data
    
    # Mapeo de botones a funciones
    if action == "btn_vincular":
        from vincular_handler import handle_vincular
        return await handle_vincular(update, context)
    elif action == "btn_summary":
        from summary_handler import get_resumen
        return await get_resumen(update, context)
    elif action == "btn_tasks":
        # FIX Problema 5: implementar correctamente la consulta de tareas
        from info_handler import handle_get_tasks
        return await handle_get_tasks(update, context, {})
    elif action == "btn_new":
        from telegram import InlineKeyboardMarkup, InlineKeyboardButton
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📁 Nuevo Proyecto", callback_data="btn_new_proj"),
             InlineKeyboardButton("✅ Nueva Tarea",    callback_data="btn_new_task")]
        ])
        await query.message.reply_text("➕ <b>¿Qué deseas crear?</b>", reply_markup=kb, parse_mode='HTML')
    elif action == "btn_write":
        from writing_handler import start_redactar
        return await start_redactar(update, context)
    elif action == "btn_focus":
        from focus_handler import start_focus
        return await start_focus(update, context)
    elif action == "btn_help_me":
        from anti_paralysis_handler import start_anti_paralysis
        return await start_anti_paralysis(update, context)
    elif action == "btn_recover":
        from recovery_handler import start_recovery
        return await start_recovery(update, context)
    
    # Sub-botones — FIX Problema 2/4: estos ahora son entry_points del project_conv_handler
    # El CallbackQueryHandler del ConversationHandler los captura antes que este handler
    # gracias al orden de registro en main.py (project_conv_handler primero).

# ---------------------------------------------------------------------------
# Flujo guiado: Creación de Proyecto
# ---------------------------------------------------------------------------

async def start_project_creation(update: Update, context: ContextTypes.DEFAULT_TYPE, entities=None):
    """
    Inicia el flujo de creación de proyecto.
    """
    # FIX Problema 9: limpiar entidades placeholder del LLM
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

    # Paso 1: capturar nombre
    if not project.get("name"):
        project["name"] = text
        context.user_data['new_project'] = project
        await update.effective_message.reply_text("Entendido. Ahora, describe brevemente el objetivo del proyecto.")
        return AWAITING_PROJECT_DETAILS

    # Paso 2: capturar descripción
    if not project.get("description"):
        project["description"] = text
        context.user_data['new_project'] = project
        await update.effective_message.reply_text("Perfecto. ¿Para qué fecha debería estar terminado? (Ejemplo: 2026-06-30)")
        return AWAITING_PROJECT_DETAILS

    # Paso 3: capturar fecha → validar formato y mostrar resumen
    # BUG 15 FIX: validar formato de fecha antes de aceptarlo
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
    """
    Inicia el flujo de creación de tarea.
    """
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    chat_id = update.effective_chat.id
    task_name = clean_entity(entities.get("task_name")) if entities else None
    context.user_data['new_task'] = {"name": task_name} if task_name else {}
    
    # Obtener proyectos para mostrar lista
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
    
    # Obtener el nombre del proyecto seleccionado
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
            # Ya tenemos nombre (de la IA), vamos a prioridad
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
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
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    from datetime import datetime, timedelta

    query = update.callback_query
    text = update.message.text if update.message else None
    data = query.data if query else None

    # Helper para botones de fecha
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

    # PASO: Título
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

    # PASO: Prioridad
    if data and data.startswith("prio_"):
        await query.answer()
        task["priority"] = data.replace("prio_", "")
        context.user_data['new_task'] = task
        await query.edit_message_text("¿Cuándo debería <b>iniciar</b>? (YYYY-MM-DD o usa los botones)", parse_mode='HTML', reply_markup=get_date_keyboard("sdate_"))
        return AWAITING_TASK_START_DATE

    # PASO: Start Date
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

    # PASO: Deadline
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

    # PASO: Horas
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

    # PASO: Recurrencia
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

    # PASO: Asignado
    if data and data.startswith("assign_"):
        await query.answer()
        task["assignee"] = data.replace("assign_", "")
        context.user_data['new_task'] = task
        
        # Resumen final
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
                "assignee_id": None # Pendiente de resolver ID real si es 'self'
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
# Actualizaciones de perfil
# ---------------------------------------------------------------------------

async def handle_skills_update(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    skills = entities.get("skills", [])
    if not skills:
        await update.effective_message.reply_text("No he detectado qué skills quieres agregar. ¿Podrías repetirlo?")
        return
    
    chat_id = update.effective_chat.id
    client = get_http_client()
    try:
        res = await client.post("/telegram/update-skills", json={
            "telegram_chat_id": chat_id,
            "skills": skills
        })
        if res.status_code == 200:
            skills_str = ", ".join(skills)
            await update.effective_message.reply_text(f"✅ ¡Genial! He añadido estos skills a tu perfil: <b>{skills_str}</b>", parse_mode='HTML')
        else:
            await update.effective_message.reply_text("Hubo un problema actualizando tus skills.")
    except Exception as e:
        await update.effective_message.reply_text(f"Error de conexión: {e}")

async def handle_availability_update(update: Update, context: ContextTypes.DEFAULT_TYPE, entities: dict):
    hours = entities.get("hours_per_day")
    if not hours:
        await update.effective_message.reply_text("¿Cuántas horas al día quieres configurar?")
        return
    
    chat_id = update.effective_chat.id
    client = get_http_client()
    try:
        res = await client.post("/telegram/update-availability", json={
            "telegram_chat_id": chat_id,
            "hours_per_day": float(hours)
        })
        if res.status_code == 200:
            await update.effective_message.reply_text(f"✅ He actualizado tu disponibilidad a <b>{hours} horas</b> al día.", parse_mode='HTML')
        else:
            await update.effective_message.reply_text("Hubo un problema actualizando tu disponibilidad.")
    except Exception as e:
        await update.effective_message.reply_text(f"Error de conexión: {e}")

# ---------------------------------------------------------------------------
# Definición de Handlers para exportar
# FIX Problema 2/4: entry_points incluyen CallbackQueryHandler para los botones
#                   inline btn_new_proj y btn_new_task, y per_message=False para
#                   permitir CallbackQuery dentro de los estados.
# ---------------------------------------------------------------------------

natural_language_handler = MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message)
inline_button_handler = CallbackQueryHandler(handle_inline_button, pattern="^btn_")

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
