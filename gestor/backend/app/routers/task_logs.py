from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task_log import TaskLog
from app.models.notification import Notification
from app.schemas import task_log as schemas
import re
from typing import List, Any

router = APIRouter()

def process_mentions(content: str, db: Session, current_user: User, task_id: int):
    # Regex para detectar @NombreUsuario o similar. 
    # Para el MVP, buscaremos coincidencias exactas con full_name o simplemente dispararemos a todos los del equipo si se usa @team
    mentions = re.findall(r"@(\w+)", content)
    for name in mentions:
        # Buscar usuario por nombre (insensible a mayúsculas simplificado)
        user = db.query(User).filter(User.full_name.ilike(f"%{name}%")).first()
        if user:
            notif = Notification(
                user_id=user.id,
                type="mention",
                message=f"{current_user.full_name} te mencionó en una tarea.",
                link=f"/tasks" # Podríamos mejorar el link con el ID
            )
            db.add(notif)

@router.get("/{task_id}", response_model=List[schemas.TaskLog])
def read_task_logs(task_id: int, db: Session = Depends(get_db)) -> Any:
    logs = db.query(TaskLog).filter(TaskLog.task_id == task_id).order_by(TaskLog.created_at.desc()).all()
    # Inyectar nombres de usuario para el frontend
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        log.user_name = user.full_name if user else "Unknown"
    return logs

@router.post("/", response_model=schemas.TaskLog)
def create_comment(
    data: schemas.TaskLogCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
) -> Any:
    log = TaskLog(
        task_id=data.task_id,
        user_id=current_user.id,
        log_type="comment",
        content=data.content
    )
    db.add(log)
    
    # Procesar menciones
    process_mentions(data.content, db, current_user, data.task_id)
    
    db.commit()
    db.refresh(log)
    log.user_name = current_user.full_name
    return log
