import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# Estados de la conversación
STEP_OPEN_APP = 1
STEP_SUBJECT = 2
STEP_RECIPIENT = 3
STEP_SEND = 4

async def start_anti_paralysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Inicia el modo de ejecución asistida (Anti-Parálisis).
    """
    keyboard = [
        [InlineKeyboardButton("Sí, está abierto", callback_data="ap_open_yes")],
        [InlineKeyboardButton("Voy a abrirlo ahora", callback_data="ap_open_wait")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "💪 *Modo Anti-Parálisis activado*\n\n"
        "Te voy a acompañar paso a paso para que termines esa tarea que te está costando.\n\n"
        "Primero: ¿tienes la aplicación o el correo donde vas a trabajar abierto en este momento?",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return STEP_OPEN_APP

async def handle_open_app(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("Sí, ya tiene", callback_data="ap_subject_yes")],
        [InlineKeyboardButton("No, vamos a definirlo", callback_data="ap_subject_no")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "Perfecto. Sigamos.\n\n"
        "¿Ya tiene un asunto o título claro?",
        reply_markup=reply_markup
    )
    return STEP_SUBJECT

async def handle_subject(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("Sí, verificado", callback_data="ap_recipient_yes")],
        [InlineKeyboardButton("Dejame verificar", callback_data="ap_recipient_check")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "Bien. Penúltimo paso:\n\n"
        "¿Están los destinatarios o responsables correctos seleccionados?",
        reply_markup=reply_markup
    )
    return STEP_RECIPIENT

async def handle_recipient(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("¡HECHO! ✅", callback_data="ap_done")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "🚀 *¡Todo listo!*\n\n"
        "Ya no hay más bloqueos. Haz clic en 'Enviar' o 'Guardar' ahora mismo.\n\n"
        "Avísame cuando lo hayas hecho presionando el botón de abajo.",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return STEP_SEND

async def handle_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    await query.edit_message_text(
        "✅ *¡Excelente trabajo!*\n\n"
        "Has vencido la parálisis. Esa pequeña acción es una gran victoria.\n"
        "¿Quieres que registremos esta tarea como completada en SmartTrack?",
        parse_mode='Markdown'
    )
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Modo anti-parálisis desactivado. ¡Tú puedes!")
    return ConversationHandler.END

anti_paralysis_handler = ConversationHandler(
    entry_points=[CommandHandler('ayudame', start_anti_paralysis)],
    states={
        STEP_OPEN_APP: [CallbackQueryHandler(handle_open_app, pattern="^ap_open_")],
        STEP_SUBJECT: [CallbackQueryHandler(handle_subject, pattern="^ap_subject_")],
        STEP_RECIPIENT: [CallbackQueryHandler(handle_recipient, pattern="^ap_recipient_")],
        STEP_SEND: [CallbackQueryHandler(handle_done, pattern="^ap_done")],
    },
    fallbacks=[CommandHandler('cancel', cancel)],
)
