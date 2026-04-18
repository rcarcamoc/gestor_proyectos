from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
import string
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.telegram import VinculationToken, TelegramAccount
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class TelegramLinkRequest(BaseModel):
    token: str
    telegram_chat_id: int

class VinculationTokenResponse(BaseModel):
    token: str
    expires_at: datetime

@router.post("/generate-token", response_model=VinculationTokenResponse)
def generate_vinculation_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Genera un token de vinculación temporal para el usuario actual.
    """
    # Eliminar tokens anteriores del mismo usuario
    db.query(VinculationToken).filter(VinculationToken.user_id == current_user.id).delete()

    # Generar token de 6 caracteres (mayúsculas y números)
    token_chars = string.ascii_uppercase + string.digits
    token = ''.join(secrets.choice(token_chars) for _ in range(6))

    expires_at = datetime.now() + timedelta(minutes=10)

    db_token = VinculationToken(
        token=token,
        user_id=current_user.id,
        expira_en=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)

    return db_token

@router.post("/link")
def link_telegram_account(
    request: TelegramLinkRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint (interno o para el bot) para vincular una cuenta de Telegram usando un token.
    """
    token_db = db.query(VinculationToken).filter(
        VinculationToken.token == request.token,
        VinculationToken.usado == False,
        VinculationToken.expira_en > datetime.now()
    ).first()

    if not token_db:
        raise HTTPException(status_code=404, detail="Token inválido o expirado")

    # Verificar si el chat_id ya está vinculado
    existing_account = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id
    ).first()

    if existing_account:
        # Si ya existe, actualizamos el usuario asociado
        existing_account.user_id = token_db.user_id
        existing_account.activo = True
    else:
        new_account = TelegramAccount(
            user_id=token_db.user_id,
            telegram_chat_id=request.telegram_chat_id,
            activo=True
        )
        db.add(new_account)

    token_db.usado = True
    db.commit()

    # Obtener info del usuario para confirmación
    user = db.query(User).filter(User.id == token_db.user_id).first()

    return {
        "status": "success",
        "message": "Cuenta vinculada correctamente",
        "user_full_name": user.full_name
    }

@router.get("/status")
def get_telegram_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifica si el usuario actual tiene una cuenta de Telegram vinculada.
    """
    account = db.query(TelegramAccount).filter(
        TelegramAccount.user_id == current_user.id,
        TelegramAccount.activo == True
    ).first()

    return {
        "is_linked": account is not None,
        "telegram_chat_id": account.telegram_chat_id if account else None
    }
