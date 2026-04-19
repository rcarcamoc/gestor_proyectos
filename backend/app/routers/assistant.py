from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from pydantic import BaseModel
import httpx
import os

from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
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
    ai_response = await ai_service.get_response(current_user.full_name, request.message)
    
    return {
        "response": ai_response,
        "intent": "general"
    }
