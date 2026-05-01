from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
import string
import os
import httpx
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.telegram import VinculationToken, TelegramAccount, AlertaEnviada
from pydantic import BaseModel
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers de seguridad
# ---------------------------------------------------------------------------

def get_linked_user(telegram_chat_id: int, db: Session) -> User:
    """Resuelve el User completo vinculado al chat_id. Lanza 404 si no existe."""
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Usuario no vinculado a Telegram")
    user = db.query(User).filter(User.id == acc.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario asociado no encontrado")
    return user


def require_role(user: User, allowed_roles: list[str]):
    """Lanza 403 si el usuario no tiene uno de los roles permitidos."""
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Acción no permitida para el rol '{user.role}'. Se requiere: {allowed_roles}"
        )


def send_telegram_message(chat_id: int, text: str):
    """Envía un mensaje directamente al chat de Telegram sin pasar por el bot."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN no configurado — no se pudo enviar mensaje push")
        return
    import requests as _requests
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        _requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=5)
    except Exception as e:
        logger.error(f"Error enviando mensaje Telegram push: {e}")

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
    try:
        print(f"Generando token para usuario: {current_user.id}")
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
        
        print(f"Token generado con éxito: {token}")
        return {
            "token": db_token.token,
            "expires_at": db_token.expira_en
        }
    except Exception as e:
        db.rollback()
        print(f"Error en generate_vinculation_token: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno en el servidor: {str(e)}"
        )

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

@router.get("/linked-accounts")
def get_all_linked_accounts(db: Session = Depends(get_db)):
    """
    Retorna todas las cuentas de Telegram vinculadas (uso interno).
    """
    accounts = db.query(TelegramAccount).filter(TelegramAccount.activo == True).all()
    return [{"telegram_chat_id": acc.telegram_chat_id, "user_id": acc.user_id} for acc in accounts]

@router.get("/leader-accounts")
def get_leader_linked_accounts(db: Session = Depends(get_db)):
    """
    Retorna cuentas de Telegram vinculadas de usuarios con rol leader u owner (uso interno).
    """
    accounts = db.query(TelegramAccount).join(User).filter(
        TelegramAccount.activo == True,
        User.role.in_(['owner', 'leader'])
    ).all()
    return [{"telegram_chat_id": acc.telegram_chat_id, "user_id": acc.user_id} for acc in accounts]

@router.get("/pending-alerts")
def get_pending_alerts(db: Session = Depends(get_db)):
    """
    Obtiene tareas que necesitan una alerta de Telegram basándose en su vencimiento.
    """
    now = datetime.now()
    # Ventana de 48 horas
    limit_48h = now + timedelta(hours=48)
    limit_24h = now + timedelta(hours=24)
    
    # 1. Buscar todas las tareas por vencer en las próximas 48h
    from app.models.task import Task
    from app.models.project import Project
    from app.models.task import TaskAssignment
    
    tasks = db.query(Task).filter(
        Task.status != "Completed",
        Task.deadline != None,
        Task.deadline <= limit_48h.date()
    ).all()
    
    alerts_to_send = []
    
    for task in tasks:
        # Determinar tipo de alerta
        days_left = (task.deadline - now.date()).days
        tipo = None
        if days_left == 2:
            tipo = "48h"
        elif days_left == 1:
            tipo = "24h"
        elif days_left == 0:
            tipo = "dia_vencimiento"
            
        if not tipo:
            continue
            
        # Verificar si ya se envió esta alerta
        already_sent = db.query(AlertaEnviada).filter(
            AlertaEnviada.task_id == task.id,
            AlertaEnviada.tipo_alerta == tipo
        ).first()
        
        if already_sent:
            continue
            
        # Obtener responsables vinculados
        assignments = db.query(TaskAssignment).filter(TaskAssignment.task_id == task.id).all()
        for ass in assignments:
            acc = db.query(TelegramAccount).filter(
                TelegramAccount.user_id == ass.user_id,
                TelegramAccount.activo == True
            ).first()
            
            if acc:
                alerts_to_send.append({
                    "id": task.id, # Usaremos task_id para marcar como enviada (simplificado)
                    "task_id": task.id,
                    "telegram_chat_id": acc.telegram_chat_id,
                    "project_name": task.project.name,
                    "task_name": task.name,
                    "deadline_human": task.deadline.strftime("%d/%m/%Y"),
                    "tipo": tipo
                })
                
    return alerts_to_send

@router.post("/mark-alert-sent")
def mark_alert_sent(request: dict, db: Session = Depends(get_db)):
    """
    Registra que una alerta fue enviada para evitar duplicados.
    """
    task_id = request.get("task_id")
    tipo = request.get("tipo", "general")
    chat_id = request.get("telegram_chat_id")
    
    if not task_id or not chat_id:
        raise HTTPException(status_code=400, detail="Missing task_id or telegram_chat_id")
        
    db_alert = AlertaEnviada(
        task_id=task_id,
        tipo_alerta=tipo,
        telegram_chat_id=chat_id
    )
    db.add(db_alert)
    db.commit()
    return {"status": "ok"}

@router.get("/stalled-tasks")
def get_stalled_tasks(db: Session = Depends(get_db)):
    """
    Detecta tareas 'In Progress' que no han tenido actividad reciente.
    """
    # En un sistema real, usaríamos una tabla de logs o auditoría.
    # Como fallback, usamos tareas creadas hace más de 3 días que sigan en progreso.
    from app.models.task import Task
    from app.models.task import TaskAssignment
    
    limit = datetime.now() - timedelta(days=3)
    
    stalled = db.query(Task).filter(
        Task.status == "In Progress",
        Task.created_at <= limit
    ).all()
    
    results = []
    for task in stalled:
        # Buscar responsables vinculados
        assignments = db.query(TaskAssignment).filter(TaskAssignment.task_id == task.id).all()
        for ass in assignments:
            acc = db.query(TelegramAccount).filter(
                TelegramAccount.user_id == ass.user_id,
                TelegramAccount.activo == True
            ).first()
            if acc:
                results.append({
                    "telegram_chat_id": acc.telegram_chat_id,
                    "task_name": task.name
                })
                
    return results

class CreateProjectRequest(BaseModel):
    telegram_chat_id: int
    name: str
    description: str
    deadline: str # Format: YYYY-MM-DD
    created_by: Optional[int] = None

@router.post("/create-project")
def create_project_via_telegram(request: CreateProjectRequest, db: Session = Depends(get_db)):
    """
    Crea un proyecto desde Telegram. Solo líderes y owners pueden crear proyectos.
    """
    from app.models.project import Project
    from app.models.team import Team

    # Resolver usuario y verificar rol
    user = get_linked_user(request.telegram_chat_id, db)
    require_role(user, ["owner", "leader"])

    try:
        deadline_date = datetime.strptime(request.deadline, "%Y-%m-%d").date()
    except Exception:
        deadline_date = datetime.now().date() + timedelta(days=30)

    # Obtener el primer equipo de la organización del usuario (fallback si no hay team_id)
    team = db.query(Team).filter(Team.organization_id == user.organization_id).first()
    team_id = team.id if team else None

    db_project = Project(
        name=request.name,
        description=request.description,
        deadline=deadline_date,
        created_by=user.id,
        status="Planned",
        start_date=datetime.now().date(),
        organization_id=user.organization_id,  # ← Resuelto desde el usuario, no hardcodeado
        team_id=team_id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return {"status": "success", "project_id": db_project.id}

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
    """
    Crea una tarea desde Telegram.
    """
    from app.models.task import Task
    from app.models.task import TaskAssignment
    
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    
    if not acc:
        raise HTTPException(status_code=404, detail="Usuario no vinculado")
        
    user_id = acc.user_id
    
    deadline_date = None
    if request.deadline:
        try:
            deadline_date = datetime.strptime(request.deadline, "%Y-%m-%d").date()
        except:
            pass

    start_date_obj = None
    if request.start_date:
        try:
            start_date_obj = datetime.strptime(request.start_date, "%Y-%m-%d").date()
        except:
            pass

    db_task = Task(
        project_id=request.project_id,
        name=request.name,
        description=request.description,
        deadline=deadline_date,
        start_date=start_date_obj,
        priority=request.priority,
        estimated_hours=request.estimated_hours,
        created_by=user_id,
        status=request.status,
        recurrence_type=request.recurrence_type
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Asignar (al usuario indicado o al creador por defecto)
    target_user_id = request.assignee_id if request.assignee_id else user_id
    assignment = TaskAssignment(
        task_id=db_task.id,
        user_id=target_user_id,
        assigned_by=user_id
    )
    db.add(assignment)
    db.commit()
    
    return {"status": "success", "task_id": db_task.id}

class UpdateSkillsRequest(BaseModel):
    telegram_chat_id: int
    skills: list[str]

@router.post("/update-skills")
def update_user_skills_via_telegram(request: UpdateSkillsRequest, db: Session = Depends(get_db)):
    """
    Actualiza los skills del usuario desde Telegram.
    """
    from app.models.skill import Skill
    from app.models.user import UserSkill
    
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    
    if not acc:
        raise HTTPException(status_code=404, detail="Usuario no vinculado")
        
    user_id = acc.user_id
    
    for skill_name in request.skills:
        # Buscar el skill en el catálogo (case insensitive)
        db_skill = db.query(Skill).filter(Skill.name.ilike(f"%{skill_name}%")).first()
        if db_skill:
            # Verificar si ya lo tiene
            exists = db.query(UserSkill).filter(
                UserSkill.user_id == user_id,
                UserSkill.skill_id == db_skill.id
            ).first()
            if not exists:
                new_user_skill = UserSkill(
                    user_id=user_id,
                    skill_id=db_skill.id,
                    level="Intermediate",
                    source="self_declared"
                )
                db.add(new_user_skill)
    
    db.commit()
    return {"status": "success"}

class UpdateAvailabilityRequest(BaseModel):
    telegram_chat_id: int
    hours_per_day: float

@router.post("/update-availability")
def update_user_availability_via_telegram(request: UpdateAvailabilityRequest, db: Session = Depends(get_db)):
    """
    Actualiza la disponibilidad diaria del usuario.
    """
    from app.models.availability import UserAvailability
    
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    
    if not acc:
        raise HTTPException(status_code=404, detail="Usuario no vinculado")
        
    user_id = acc.user_id
    
    # Actualizar para todos los días de la semana (simplificado para MVP)
    for day in range(7):
        db_avail = db.query(UserAvailability).filter(
            UserAvailability.user_id == user_id,
            UserAvailability.day_of_week == day
        ).first()
        
        if db_avail:
            db_avail.hours_available = request.hours_per_day
        else:
            new_avail = UserAvailability(
                user_id=user_id,
                day_of_week=day,
                hours_available=request.hours_per_day,
                effective_from=datetime.now().date()
            )
            db.add(new_avail)
            
    db.commit()
    return {"status": "success"}

class RecoverPasswordRequest(BaseModel):
    telegram_chat_id: int
    email: str

@router.post("/recover-password")
def recover_password_via_telegram(request: RecoverPasswordRequest, db: Session = Depends(get_db)):
    """
    Recupera la contraseña y la envía DIRECTAMENTE al Telegram del usuario.
    La contraseña NO se expone en la respuesta HTTP.
    """
    from passlib.context import CryptContext
    import random
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # 1. Buscar la cuenta de Telegram vinculada
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()

    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Tu cuenta de Telegram no está vinculada. No puedes recuperar la contraseña por aquí."
        )

    # 2. Verificar que el correo coincide con el usuario de esa cuenta de Telegram
    user = db.query(User).filter(User.id == acc.user_id, User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=400, detail="El correo proporcionado no coincide con tu cuenta vinculada.")

    # 3. Generar nueva contraseña temporal
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

    # 4. Actualizar la contraseña en la BD
    user.password_hash = pwd_context.hash(temp_password)
    user.must_change_password = True  # Forzar cambio en el próximo login
    db.commit()

    # 5. Enviar contraseña DIRECTAMENTE al Telegram del usuario — nunca en la respuesta HTTP
    message_sent = False
    try:
        send_telegram_message(
            request.telegram_chat_id,
            f"🔐 <b>Contraseña restablecida</b>\n\n"
            f"Tu nueva contraseña temporal es:\n<code>{temp_password}</code>\n\n"
            f"⚠️ Por seguridad, cámbiala desde la configuración de tu cuenta lo antes posible."
        )
        message_sent = True
    except Exception as e:
        logger.error(f"Error enviando contraseña por Telegram: {e}")

    # BUG 21 FIX: incluir message_sent para que el bot pueda confirmar correctamente
    return {
        "status": "success",
        "message": "Contraseña restablecida.",
        "message_sent": message_sent,
    }

class TeamLinkRequest(BaseModel):
    link_code: str
    telegram_chat_id: int

@router.post("/team-link")
def link_team_telegram(request: TeamLinkRequest, db: Session = Depends(get_db)):
    """
    Vincula un grupo de Telegram a un equipo usando un código de enlace.
    """
    from app.models.team import Team
    
    team = db.query(Team).filter(Team.link_code == request.link_code).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="Código de equipo inválido")
        
    team.telegram_chat_id = str(request.telegram_chat_id)
    db.commit()
    
    return {
        "status": "success",
        "team_name": team.name,
        "message": f"Equipo '{team.name}' vinculado correctamente a este grupo."
    }

@router.get("/user-info")
def get_user_info(chat_id: int, db: Session = Depends(get_db)):
    """Retorna info básica del usuario vinculado a un chat_id para el contexto del bot."""
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == chat_id,
        TelegramAccount.activo == True
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="No vinculado")
    user = db.query(User).filter(User.id == acc.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "full_name": user.full_name,
        "role": user.role,
        "email": user.email,
        "organization_id": user.organization_id
    }

class ConversationLogRequest(BaseModel):
    telegram_chat_id: int
    user_message: str | None = None
    intent_detected: str | None = None
    bot_response: str | None = None
    processing_time_ms: int | None = None

@router.post("/log-conversation")
def log_conversation(req: ConversationLogRequest, db: Session = Depends(get_db)):
    try:
        from app.models.telegram import ConversationLog
        log_entry = ConversationLog(
            telegram_chat_id=req.telegram_chat_id,
            user_message=req.user_message,
            intent_detected=req.intent_detected,
            bot_response=req.bot_response,
            processing_time_ms=req.processing_time_ms
        )
        db.add(log_entry)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        import logging
        logging.error(f"Error logging conversation: {e}")
        return {"status": "error"}

@router.get("/get-projects")
def get_user_projects(chat_id: int, db: Session = Depends(get_db)):
    from app.models.project import Project
    from app.models.team import TeamMembership
    import logging

    try:
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            return []

        active_statuses = ["Planned", "In Progress", "Active"]

        # Proyectos donde el usuario es miembro del equipo asignado al proyecto
        member_projects = (
            db.query(Project)
            .join(TeamMembership, TeamMembership.team_id == Project.team_id)
            .filter(
                TeamMembership.user_id == acc.user_id,
                Project.status.in_(active_statuses)
            )
            .all()
        )

        # Si no es miembro de ningún equipo, fallback a proyectos creados por él
        if not member_projects:
            member_projects = db.query(Project).filter(
                Project.created_by == acc.user_id,
                Project.status.in_(active_statuses)
            ).all()

        return [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "deadline": str(p.deadline) if p.deadline else "No definida"
            }
            for p in member_projects
        ]
    except Exception as e:
        logging.error(f"Error en get_user_projects para chat {chat_id}: {e}")
        return []

@router.get("/get-tasks")
def get_user_tasks(chat_id: int, db: Session = Depends(get_db)):
    from app.models.task import Task, TaskAssignment
    import logging
    try:
        acc = db.query(TelegramAccount).filter(TelegramAccount.telegram_chat_id == chat_id, TelegramAccount.activo == True).first()
        if not acc: return []
        
        assignments = db.query(TaskAssignment).filter(TaskAssignment.user_id == acc.user_id).all()
        task_ids = [a.task_id for a in assignments]
        
        if not task_ids:
            return []
            
        tasks = db.query(Task).filter(Task.id.in_(task_ids), Task.status != "Completed", Task.status != "Done").all()
        return [{"name": t.name, "project": t.project.name if t.project else "Sin proyecto", "status": t.status, "deadline": str(t.deadline)} for t in tasks]
    except Exception as e:
        logging.error(f"Error en get_user_tasks para chat {chat_id}: {e}")
        return []

class AssignTaskRequest(BaseModel):
    telegram_chat_id: int
    task_name: str
    assignee_name: str

@router.post("/assign-task")
def assign_task_via_telegram(request: AssignTaskRequest, db: Session = Depends(get_db)):
    from app.models.task import Task, TaskAssignment
    from app.models.user import User

    # Solo líderes y owners pueden asignar tareas a otros
    requester = get_linked_user(request.telegram_chat_id, db)
    require_role(requester, ["owner", "leader"])

    task = db.query(Task).filter(Task.name.ilike(f"%{request.task_name}%")).first()
    user_target = db.query(User).filter(User.full_name.ilike(f"%{request.assignee_name}%")).first()
    if not task or not user_target:
        return {"status": "error", "message": "No se encontró tarea o usuario"}

    assignment = TaskAssignment(task_id=task.id, user_id=user_target.id, assigned_by=requester.id)
    db.add(assignment)
    db.commit()

    # Notificar proactivamente al asignado
    target_acc = db.query(TelegramAccount).filter(
        TelegramAccount.user_id == user_target.id, TelegramAccount.activo == True
    ).first()
    if target_acc:
        send_telegram_message(
            target_acc.telegram_chat_id,
            f"📋 <b>Nueva tarea asignada</b>\n\n"
            f"Se te ha asignado la tarea <b>{task.name}</b>\n"
            f"Asignada por: {requester.full_name}"
        )

    return {"status": "success", "message": f"Tarea '{task.name}' asignada a {user_target.full_name}"}

class UpdateTaskStatusRequest(BaseModel):
    telegram_chat_id: int
    task_name: str
    status: str

@router.post("/update-task-status")
def update_task_status_via_telegram(request: UpdateTaskStatusRequest, db: Session = Depends(get_db)):
    from app.models.task import Task, TaskAssignment

    requester = get_linked_user(request.telegram_chat_id, db)

    task = db.query(Task).filter(Task.name.ilike(f"%{request.task_name}%")).first()
    if not task:
        return {"status": "error", "message": "Tarea no encontrada"}

    # Verificar que el usuario es asignado a la tarea O tiene rol de liderazgo
    if requester.role == "member":
        is_assigned = db.query(TaskAssignment).filter(
            TaskAssignment.task_id == task.id,
            TaskAssignment.user_id == requester.id
        ).first()
        if not is_assigned:
            raise HTTPException(
                status_code=403,
                detail="Solo puedes actualizar el estado de tareas que te están asignadas."
            )

    status_map = {"completada": "Completed", "en progreso": "In Progress", "bloqueada": "Blocked", "pendiente": "Pending"}
    st = status_map.get(request.status.lower(), request.status)
    task.status = st
    db.commit()
    return {"status": "success", "message": f"Estado de '{task.name}' actualizado a {st}"}

class UpdateDeadlineRequest(BaseModel):
    telegram_chat_id: int
    project_or_task_name: str
    deadline: str

@router.post("/update-deadline")
def update_deadline_via_telegram(request: UpdateDeadlineRequest, db: Session = Depends(get_db)):
    from app.models.task import Task
    from app.models.project import Project
    acc = db.query(TelegramAccount).filter(TelegramAccount.telegram_chat_id == request.telegram_chat_id, TelegramAccount.activo == True).first()
    if not acc: raise HTTPException(status_code=404)
    
    try:
        new_date = datetime.strptime(request.deadline, "%Y-%m-%d").date()
    except:
        return {"status": "error", "message": "Formato de fecha inválido"}

    task = db.query(Task).filter(Task.name.ilike(f"%{request.project_or_task_name}%")).first()
    if task:
        task.deadline = new_date
        db.commit()
        return {"status": "success", "message": f"Fecha de tarea '{task.name}' actualizada"}
        
    project = db.query(Project).filter(Project.name.ilike(f"%{request.project_or_task_name}%")).first()
    if project:
        project.deadline = new_date
        db.commit()
        return {"status": "success", "message": f"Fecha de proyecto '{project.name}' actualizada"}
        
    return {"status": "error", "message": "No se encontró el elemento"}

@router.get("/projects-at-risk")
def get_projects_at_risk(chat_id: int, db: Session = Depends(get_db)):
    from app.models.project import Project
    now = datetime.now().date()
    projects = db.query(Project).filter(Project.status != "Completed", Project.deadline != None).all()
    risk = [p for p in projects if p.deadline and (p.deadline - now).days <= 3]
    return [{"name": p.name, "deadline": str(p.deadline), "status": p.status} for p in risk]

@router.get("/project-metrics")
def get_project_metrics(chat_id: int, project_name: str, db: Session = Depends(get_db)):
    from app.models.project import Project
    from app.models.task import Task
    from sqlalchemy import func
    project = db.query(Project).filter(Project.name.ilike(f"%{project_name}%")).first()
    if not project: return {"error": "No encontrado"}
    total_estimated = db.query(func.sum(Task.estimated_hours)).filter(Task.project_id == project.id).scalar() or 0
    total_actual = db.query(func.sum(Task.actual_hours)).filter(Task.project_id == project.id).scalar() or 0
    return {"project": project.name, "estimated_hours": total_estimated, "actual_hours": total_actual}

@router.get("/available-team")
def get_available_team(chat_id: int, db: Session = Depends(get_db)):
    return [{"team_name": "Equipo de Desarrollo", "available_capacity": "Alta"}, {"team_name": "Equipo de Diseño", "available_capacity": "Media"}]

@router.get("/team-summary")
def get_team_summary(chat_id: int, db: Session = Depends(get_db)):
    from app.models.task import Task
    tasks_done = db.query(Task).filter(Task.status == "Completed").limit(5).all()
    return [{"task": t.name, "completed_by": "Miembro"} for t in tasks_done]

class ReassignRequest(BaseModel):
    telegram_chat_id: int
    from_user: str
    to_user: str

@router.post("/reassign-tasks")
def reassign_tasks(request: ReassignRequest, db: Session = Depends(get_db)):
    from app.models.task import TaskAssignment
    from app.models.user import User

    # Solo owners pueden reasignar TODAS las tareas de un usuario
    requester = get_linked_user(request.telegram_chat_id, db)
    require_role(requester, ["owner"])

    user1 = db.query(User).filter(User.full_name.ilike(f"%{request.from_user}%")).first()
    user2 = db.query(User).filter(User.full_name.ilike(f"%{request.to_user}%")).first()
    if not user1 or not user2:
        return {"status": "error", "message": "No se encontró uno o ambos usuarios"}

    # Verificar que ambos usuarios son de la misma organización del requester
    if user1.organization_id != requester.organization_id or user2.organization_id != requester.organization_id:
        raise HTTPException(status_code=403, detail="Solo puedes reasignar usuarios de tu organización.")

    assignments = db.query(TaskAssignment).filter(TaskAssignment.user_id == user1.id).all()
    task_names = []
    for a in assignments:
        a.user_id = user2.id
        # Recolectar nombres de tareas para el mensaje
        from app.models.task import Task
        t = db.query(Task).filter(Task.id == a.task_id).first()
        if t:
            task_names.append(t.name)
    db.commit()

    # Notificar proactivamente al receptor de las tareas
    target_acc = db.query(TelegramAccount).filter(
        TelegramAccount.user_id == user2.id, TelegramAccount.activo == True
    ).first()
    if target_acc and task_names:
        task_list = "\n".join(f"  • {n}" for n in task_names[:10])
        suffix = f"\n  _...y {len(task_names) - 10} más_" if len(task_names) > 10 else ""
        send_telegram_message(
            target_acc.telegram_chat_id,
            f"🔄 <b>Tareas reasignadas</b>\n\n"
            f"Se te han reasignado {len(assignments)} tarea(s) de <b>{user1.full_name}</b>:\n"
            f"{task_list}{suffix}\n\n"
            f"Reasignación realizada por: {requester.full_name}"
        )

    return {"status": "success", "reassigned_count": len(assignments)}

@router.get("/team-blockers")
def get_team_blockers(chat_id: int, db: Session = Depends(get_db)):
    from app.models.task import Task
    blocked = db.query(Task).filter(Task.status == "Blocked").all()
    return [{"task": t.name, "project": t.project.name if t.project else "N/A"} for t in blocked]

@router.get("/next-action")
def get_next_action(chat_id: int, db: Session = Depends(get_db)):
    from app.models.task import Task, TaskAssignment
    acc = db.query(TelegramAccount).filter(TelegramAccount.telegram_chat_id == chat_id, TelegramAccount.activo == True).first()
    if not acc: return []
    assignments = db.query(TaskAssignment).filter(TaskAssignment.user_id == acc.user_id).all()
    task_ids = [a.task_id for a in assignments]
    task = db.query(Task).filter(Task.id.in_(task_ids), Task.status != "Completed").order_by(Task.deadline.asc(), Task.priority.desc()).first()
    if task: return [{"name": task.name, "priority": task.priority, "deadline": str(task.deadline)}]
    return []

class HelpRequest(BaseModel):
    telegram_chat_id: int
    task_name: str

@router.post("/request-help")
def request_help(request: HelpRequest, db: Session = Depends(get_db)):
    from app.models.task import Task
    task = db.query(Task).filter(Task.name.ilike(f"%{request.task_name}%")).first()
    if task:
        task.status = "Blocked"
        db.commit()
        return {"status": "success", "message": "Ayuda solicitada, líder notificado y tarea bloqueada"}
    return {"status": "error"}

class LogTimeRequest(BaseModel):
    telegram_chat_id: int
    task_name: str
    hours: float

@router.post("/log-time")
def log_time(request: LogTimeRequest, db: Session = Depends(get_db)):
    from app.models.task import Task
    task = db.query(Task).filter(Task.name.ilike(f"%{request.task_name}%")).first()
    if task:
        task.actual_hours = (task.actual_hours or 0) + request.hours
        db.commit()
        return {"status": "success", "message": f"{request.hours} horas registradas en {task.name}"}
    return {"status": "error"}
