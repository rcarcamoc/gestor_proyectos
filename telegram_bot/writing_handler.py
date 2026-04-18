import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from gemini_service import GeminiService

# Estados
AWAITING_REQUEST = 0
CHOOSING_TONE = 1
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
gemini = GeminiService()

async def start_redactar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Dime qué necesitas escribir y yo te ayudo con el borrador.\n\n"
        "Ejemplo: 'Necesito avisar a mi jefe que el proyecto se retrasa 2 días'."
    )
    return AWAITING_REQUEST

async def process_writing_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text
    context.user_data['writing_input'] = user_input

    keyboard = [
        [
            InlineKeyboardButton("Formal", callback_data='formal'),
            InlineKeyboardButton("Directo", callback_data='directo'),
        ],
        [
            InlineKeyboardButton("Empático", callback_data='empatico'),
            InlineKeyboardButton("Breve", callback_data='breve'),
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text("¿Qué tono prefieres?", reply_markup=reply_markup)
    return CHOOSING_TONE

async def handle_tone_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    tone = query.data
    user_input = context.user_data.get('writing_input')

    await query.edit_message_text(text=f"Generando borrador en tono *{tone}*...", parse_mode='Markdown')

    prompt = (
        f"Eres un asistente de redacción profesional. Ayuda al usuario a escribir un mensaje "
        f"en tono {tone} basado en su solicitud. Devuelve el texto listo para copiar y pegar."
    )

    response = await gemini.generate_response(prompt, user_input)
    await query.message.reply_text(f"---\n{response}\n---\n\n¿Te gusta este borrador?")
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Operación cancelada.")
    return ConversationHandler.END

redactar_handler = ConversationHandler(
    entry_points=[CommandHandler('redactar', start_redactar)],
    states={
        AWAITING_REQUEST: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_writing_request)],
        CHOOSING_TONE: [CallbackQueryHandler(handle_tone_selection)],
    },
    fallbacks=[CommandHandler('cancel', cancel)],
)
