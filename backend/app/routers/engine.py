from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user, get_current_organization_id
from app.models.user import User
from app.services.engine import SmartEngine
from typing import Any

router = APIRouter()

@router.get("/status")
def get_engine_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    engine = SmartEngine(db)
    level_info = engine.evaluate_level(current_user.id)
    return {
        "motor_confidence": level_info,
        "improvement_suggestions": [
            "Agrega más skills a tu perfil",
            "Configura tu horario semanal"
        ] if level_info["level"] != "FULL" else []
    }

@router.post("/check-conflicts")
def check_task_conflicts(
    task_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Solo el líder puede chequear conflictos de otros o el mismo de los suyos
    engine = SmartEngine(db)
    return engine.check_conflicts(task_id, user_id)
