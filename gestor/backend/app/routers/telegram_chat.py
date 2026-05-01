from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.db import get_db
from app.models.telegram import TelegramAccount
from app.services.chat_engine import ChatEngine
from app.services.session_store import InMemorySessionStore
from app.services.tool_registry import registry

router = APIRouter()

# TODO: Idealmente inyectado. Por ahora instanciado globalmente para Fase 1.
global_session_store = InMemorySessionStore()

class TelegramChatRequest(BaseModel):
    telegram_chat_id: int
    message: str
    confirmation_payload: Optional[Dict[str, Any]] = None

@router.post("/chat")
async def telegram_chat_endpoint(
    request: TelegramChatRequest,
    db: Session = Depends(get_db)
):
    # Buscar cuenta de telegram activa
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    
    if not acc or not acc.user:
        return {
            "response": "Para usar SmartTrack necesitas vincular tu cuenta primero. Usa /vincular.",
            "metadata": {}
        }
        
    user = acc.user
    session_id = f"tg_{request.telegram_chat_id}"
    
    chat_engine = ChatEngine(db, global_session_store, registry)
    
    # Manejar confirmaciones pendientes si las hay (Fase 3)
    # if request.confirmation_payload: ...
    
    response_text, metadata = await chat_engine.process_message(user, session_id, request.message)
    
    return {
        "response": response_text,
        "metadata": metadata
    }

class CompletionRequest(BaseModel):
    system_prompt: str
    user_prompt: str

@router.post("/completion")
async def telegram_completion_endpoint(
    request: CompletionRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint para tareas directas (ej. resumen diario) sin historial ni context tools.
    """
    from app.services.ai_provider import AIProvider
    provider = AIProvider()
    res = await provider.generate_response(
        system_prompt=request.system_prompt,
        history=[],
        new_message=request.user_prompt,
        tools_schema=None
    )
    return {"response": res.text}
