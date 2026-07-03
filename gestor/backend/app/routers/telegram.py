from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import logging
from typing import Optional

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from pydantic import BaseModel

from app.services.telegram_service import (
    TelegramService,
    get_linked_user
)

router = APIRouter()
logger = logging.getLogger(__name__)

def require_role(user: User, allowed_roles: list[str]):
    """Lanza 403 si el usuario no tiene uno de los roles permitidos."""
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Acción no permitida para el rol '{user.role}'. Se requiere: {allowed_roles}"
        )

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
    """Genera un token de vinculación temporal para el usuario actual."""
    try:
        res = TelegramService.generate_vinculation_token(current_user.id, db)
        return res
    except Exception as e:
        logger.error(f"Error en generate_vinculation_token: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno en el servidor: {str(e)}"
        )

@router.post("/link")
def link_telegram_account(
    request: TelegramLinkRequest,
    db: Session = Depends(get_db)
):
    """Endpoint para vincular una cuenta de Telegram usando un token."""
    user = TelegramService.link_account(request.token, request.telegram_chat_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="Token inválido o expirado")

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
    """Verifica si el usuario actual tiene una cuenta de Telegram vinculada."""
    return TelegramService.get_status(current_user.id, db)

@router.get("/linked-accounts")
def get_all_linked_accounts(db: Session = Depends(get_db)):
    """Retorna todas las cuentas de Telegram vinculadas (uso interno)."""
    return TelegramService.get_linked_accounts(db)

@router.get("/leader-accounts")
def get_leader_linked_accounts(db: Session = Depends(get_db)):
    """Retorna cuentas de Telegram vinculadas de usuarios con rol leader u owner (uso interno)."""
    return TelegramService.get_linked_accounts(db, roles=["owner", "leader"])

@router.get("/pending-alerts")
def get_pending_alerts(db: Session = Depends(get_db)):
    """Obtiene tareas que necesitan una alerta de Telegram basándose en su vencimiento."""
    return TelegramService.get_pending_alerts(db)

@router.post("/mark-alert-sent")
def mark_alert_sent(request: dict, db: Session = Depends(get_db)):
    """Registra que una alerta fue enviada para evitar duplicados."""
    task_id = request.get("task_id")
    tipo = request.get("tipo", "general")
    chat_id = request.get("telegram_chat_id")
    
    if not task_id or not chat_id:
        raise HTTPException(status_code=400, detail="Missing task_id or telegram_chat_id")
        
    TelegramService.mark_alert_sent(task_id, tipo, chat_id, db)
    return {"status": "ok"}

@router.get("/stalled-tasks")
def get_stalled_tasks(db: Session = Depends(get_db)):
    """Detecta tareas 'In Progress' que no han tenido actividad reciente."""
    return TelegramService.get_stalled_tasks(db)

class CreateProjectRequest(BaseModel):
    telegram_chat_id: int
    name: str
    description: str
    deadline: str # Format: YYYY-MM-DD
    created_by: Optional[int] = None

@router.post("/create-project")
def create_project_via_telegram(request: CreateProjectRequest, db: Session = Depends(get_db)):
    """Crea un proyecto desde Telegram. Solo líderes y owners pueden crear proyectos."""
    try:
        project_id = TelegramService.create_project(
            request.telegram_chat_id, request.name, request.description, request.deadline, db
        )
        return {"status": "success", "project_id": project_id}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

class CreateTaskRequest(BaseModel):
    telegram_chat_id: int
    project_id: int
    name: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    start_date: Optional[str] = None
    priority: str = "Medium"
    estimated_hours: Optional[float] = None
    status: str = "Pending"
    recurrence_type: str = "puntual"
    assignee_id: Optional[int] = None

@router.post("/create-task")
def create_task_via_telegram(request: CreateTaskRequest, db: Session = Depends(get_db)):
    """Crea una tarea desde Telegram."""
    try:
        task_id = TelegramService.create_task(
            telegram_chat_id=request.telegram_chat_id,
            project_id=request.project_id,
            name=request.name,
            description=request.description,
            deadline_str=request.deadline,
            start_date_str=request.start_date,
            priority=request.priority,
            estimated_hours=request.estimated_hours,
            status=request.status,
            recurrence_type=request.recurrence_type,
            assignee_id=request.assignee_id,
            db=db
        )
        return {"status": "success", "task_id": task_id}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

class UpdateSkillsRequest(BaseModel):
    telegram_chat_id: int
    skills: list[str]

@router.post("/update-skills")
def update_user_skills_via_telegram(request: UpdateSkillsRequest, db: Session = Depends(get_db)):
    """Actualiza los skills del usuario desde Telegram."""
    try:
        TelegramService.update_user_skills(request.telegram_chat_id, request.skills, db)
        return {"status": "success"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

class UpdateAvailabilityRequest(BaseModel):
    telegram_chat_id: int
    hours_per_day: float

@router.post("/update-availability")
def update_user_availability_via_telegram(request: UpdateAvailabilityRequest, db: Session = Depends(get_db)):
    """Actualiza la disponibilidad diaria del usuario."""
    try:
        TelegramService.update_user_availability(request.telegram_chat_id, request.hours_per_day, db)
        return {"status": "success"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

class RecoverPasswordRequest(BaseModel):
    telegram_chat_id: int
    email: str

@router.post("/recover-password")
def recover_password_via_telegram(request: RecoverPasswordRequest, db: Session = Depends(get_db)):
    """Recupera la contraseña y la envía DIRECTAMENTE al Telegram del usuario."""
    try:
        return TelegramService.recover_password(request.telegram_chat_id, request.email, db)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND if "vinculada" in str(ve) else status.HTTP_400_BAD_REQUEST, detail=str(ve))

class TeamLinkRequest(BaseModel):
    link_code: str
    telegram_chat_id: int

@router.post("/team-link")
def link_team_telegram(request: TeamLinkRequest, db: Session = Depends(get_db)):
    """Vincula un grupo de Telegram a un equipo usando un código de enlace."""
    try:
        team_name = TelegramService.link_team(request.link_code, request.telegram_chat_id, db)
        return {
            "status": "success",
            "team_name": team_name,
            "message": f"Equipo '{team_name}' vinculado correctamente a este grupo."
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.get("/user-info")
def get_user_info(chat_id: int, db: Session = Depends(get_db)):
    """Retorna info básica del usuario vinculado a un chat_id para el contexto del bot."""
    try:
        return TelegramService.get_user_info(chat_id, db)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

class ConversationLogRequest(BaseModel):
    telegram_chat_id: int
    user_message: str | None = None
    intent_detected: str | None = None
    bot_response: str | None = None
    processing_time_ms: int | None = None

@router.post("/log-conversation")
def log_conversation(req: ConversationLogRequest, db: Session = Depends(get_db)):
    """Registra una interacción de conversación en el bot."""
    TelegramService.log_conversation(
        telegram_chat_id=req.telegram_chat_id,
        user_message=req.user_message,
        intent_detected=req.intent_detected,
        bot_response=req.bot_response,
        processing_time_ms=req.processing_time_ms,
        db=db
    )
    return {"status": "success"}

@router.get("/get-projects")
def get_user_projects(chat_id: int, db: Session = Depends(get_db)):
    """Obtiene los proyectos activos vinculados al usuario."""
    return TelegramService.get_user_projects(chat_id, db)

@router.get("/get-tasks")
def get_user_tasks(chat_id: int, db: Session = Depends(get_db)):
    """Obtiene las tareas pendientes del usuario."""
    return TelegramService.get_user_tasks(chat_id, db)

class AssignTaskRequest(BaseModel):
    telegram_chat_id: int
    task_name: str
    assignee_name: str

@router.post("/assign-task")
def assign_task_via_telegram(request: AssignTaskRequest, db: Session = Depends(get_db)):
    """Asigna una tarea a otro usuario."""
    try:
        return TelegramService.assign_task(request.telegram_chat_id, request.task_name, request.assignee_name, db)
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))

class UpdateTaskStatusRequest(BaseModel):
    telegram_chat_id: int
    task_name: str
    status: str

@router.post("/update-task-status")
def update_task_status_via_telegram(request: UpdateTaskStatusRequest, db: Session = Depends(get_db)):
    """Actualiza el estado de una tarea."""
    try:
        return TelegramService.update_task_status(request.telegram_chat_id, request.task_name, request.status, db)
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))

class UpdateDeadlineRequest(BaseModel):
    telegram_chat_id: int
    project_or_task_name: str
    deadline: str

@router.post("/update-deadline")
def update_deadline_via_telegram(request: UpdateDeadlineRequest, db: Session = Depends(get_db)):
    """Actualiza la fecha límite de una tarea o proyecto."""
    try:
        return TelegramService.update_deadline(request.telegram_chat_id, request.project_or_task_name, request.deadline, db)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.get("/projects-at-risk")
def get_projects_at_risk(chat_id: int, db: Session = Depends(get_db)):
    """Obtiene proyectos que están por vencer."""
    return TelegramService.get_projects_at_risk(db)

@router.get("/project-metrics")
def get_project_metrics(chat_id: int, project_name: str, db: Session = Depends(get_db)):
    """Obtiene métricas de horas estimadas vs reales de un proyecto."""
    return TelegramService.get_project_metrics(project_name, db)

@router.get("/available-team")
def get_available_team(chat_id: int, db: Session = Depends(get_db)):
    """Retorna información agregada del equipo disponible (mocked para MVP)."""
    return [{"team_name": "Equipo de Desarrollo", "available_capacity": "Alta"}, {"team_name": "Equipo de Diseño", "available_capacity": "Media"}]

@router.get("/team-summary")
def get_team_summary(chat_id: int, db: Session = Depends(get_db)):
    """Obtiene resumen de tareas completadas recientemente."""
    return TelegramService.get_team_summary(chat_id, db)

class ReassignRequest(BaseModel):
    telegram_chat_id: int
    from_user: str
    to_user: str

@router.post("/reassign-tasks")
def reassign_tasks(request: ReassignRequest, db: Session = Depends(get_db)):
    """Reasigna tareas de un usuario a otro."""
    try:
        return TelegramService.reassign_tasks(request.telegram_chat_id, request.from_user, request.to_user, db)
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))

@router.get("/team-blockers")
def get_team_blockers(chat_id: int, db: Session = Depends(get_db)):
    """Obtiene tareas bloqueadas."""
    return TelegramService.get_team_blockers(db)

@router.get("/next-action")
def get_next_action(chat_id: int, db: Session = Depends(get_db)):
    """Obtiene la siguiente acción recomendada para el usuario."""
    return TelegramService.get_next_action(chat_id, db)

class HelpRequest(BaseModel):
    telegram_chat_id: int
    task_name: str

@router.post("/request-help")
def request_help(request: HelpRequest, db: Session = Depends(get_db)):
    """Solicita ayuda marcando la tarea como bloqueada."""
    success = TelegramService.request_help(request.task_name, db)
    return {"status": "success" if success else "error"}

class LogTimeRequest(BaseModel):
    telegram_chat_id: int
    task_name: str
    hours: float

@router.post("/log-time")
def log_time(request: LogTimeRequest, db: Session = Depends(get_db)):
    """Registra horas reales trabajadas en una tarea."""
    success = TelegramService.log_time(request.task_name, request.hours, db)
    return {"status": "success" if success else "error"}
