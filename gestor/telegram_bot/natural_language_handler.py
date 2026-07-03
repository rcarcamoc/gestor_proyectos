import logging
import os
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler, MessageHandler, filters, CallbackQueryHandler
from http_client import get_http_client
from creation_handlers import project_conv_handler

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def send_log_to_backend(chat_id: int, user_message: str, intent: str, bot_response: str = None):
    import asyncio
    client = get_http_client()
    try:
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
    """
    text = update.message.text
    chat_id = update.effective_chat.id
    text_lower = text.lower().strip()

    # 1. VERIFICAR ESTADOS ACTIVOS
    # Si está en el flujo conversacional de creación, redirigir a creation_handlers (esto ocurre por el state machine)
    if 'new_project' in context.user_data or 'new_task' in context.user_data:
        # Los handlers del ConversationHandler registrados con prioridad interceptarán esto
        return

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
    intent = None
    entities = {}
    for keywords, shortcut_intent in _DIRECT.items():
        if any(kw in text_lower for kw in keywords):
            logging.info(f"Shortcut directo detectado: {shortcut_intent}")
            intent = shortcut_intent
            break
    else:
        # ── SIN ATAJO → ENVIAR AL MOTOR CENTRAL (BACKEND) ──
        await context.bot.send_chat_action(chat_id=chat_id, action='typing')
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
        return

    # Si era un atajo de creación, redirigir a las funciones de creación importándolas
    from creation_handlers import start_project_creation, start_task_creation
    if intent == "create_project":
        await start_project_creation(update, context, entities)
        return AWAITING_PROJECT_DETAILS if 'new_project' in context.user_data else ConversationHandler.END
    elif intent == "create_task":
        await start_task_creation(update, context, entities)
        return AWAITING_TASK_PROJECT if 'new_task' in context.user_data else ConversationHandler.END
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

def get_main_inline_keyboard():
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
    query = update.callback_query
    await query.answer()
    
    action = query.data
    
    if action == "btn_vincular":
        from vincular_handler import handle_vincular
        return await handle_vincular(update, context)
    elif action == "btn_summary":
        from summary_handler import get_resumen
        return await get_resumen(update, context)
    elif action == "btn_tasks":
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

# Constantes de estados para compatibilidad con redirección interna
AWAITING_PROJECT_DETAILS = 1
AWAITING_TASK_PROJECT = 2

natural_language_handler = MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message)
inline_button_handler = CallbackQueryHandler(handle_inline_button, pattern="^btn_")
