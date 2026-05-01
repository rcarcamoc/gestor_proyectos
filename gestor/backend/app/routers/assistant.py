from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from pydantic import BaseModel
import httpx
import os

from app.services.chat_engine import ChatEngine
from app.services.session_store import InMemorySessionStore
from app.services.tool_registry import registry

router = APIRouter()

# Global temporal para Fase 1 (idealmente inyectado)
global_session_store = InMemorySessionStore()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    metadata: dict = {}
    intent: str = "general"

@router.post("/chat", response_model=ChatResponse)
async def assistant_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint para el chat del asistente web.
    """
    session_id = f"web_{current_user.id}"
    chat_engine = ChatEngine(db, global_session_store, registry)
    
    response_text, metadata = await chat_engine.process_message(current_user, session_id, request.message)
    
    return {
        "response": response_text,
        "metadata": metadata,
        "intent": metadata.get("executed_tool", "general")
    }
