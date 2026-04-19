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

    return {
        "token": db_token.token,
        "expires_at": db_token.expira_en
    }

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
    owner_id: Optional[int] = None

@router.post("/create-project")
def create_project_via_telegram(request: CreateProjectRequest, db: Session = Depends(get_db)):
    """
    Crea un proyecto desde Telegram.
    """
    from app.models.project import Project
    
    # Buscar usuario por chat_id
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    
    if not acc:
        raise HTTPException(status_code=404, detail="Usuario no vinculado")
        
    user_id = acc.user_id
    
    try:
        deadline_date = datetime.strptime(request.deadline, "%Y-%m-%d").date()
    except:
        deadline_date = datetime.now().date() + timedelta(days=30)

    db_project = Project(
        name=request.name,
        description=request.description,
        deadline=deadline_date,
        owner_id=user_id,
        status="Active"
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
    priority: str = "Medium"

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

    db_task = Task(
        project_id=request.project_id,
        name=request.name,
        description=request.description,
        deadline=deadline_date,
        priority=request.priority,
        created_by=user_id,
        status="Pending"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Auto-asignar al usuario que la creó
    assignment = TaskAssignment(
        task_id=db_task.id,
        user_id=user_id,
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
                hours_available=request.hours_per_day
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
    Recupera la contraseña y la envía por Telegram si el correo coincide.
    """
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # 1. Buscar la cuenta de Telegram vinculada
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == request.telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    
    if not acc:
        raise HTTPException(status_code=404, detail="Tu cuenta de Telegram no está vinculada. No puedes recuperar la contraseña por aquí.")
        
    # 2. Verificar que el correo coincide con el usuario de esa cuenta de Telegram
    user = db.query(User).filter(User.id == acc.user_id, User.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="El correo proporcionado no coincide con tu cuenta vinculada.")
        
    # 3. Generar nueva contraseña temporal
    import random
    import string
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    
    # 4. Actualizar la contraseña en la BD
    user.hashed_password = pwd_context.hash(temp_password)
    db.commit()
    
    # 5. Devolver la contraseña temporal para que el bot se la envíe al usuario
    return {
        "status": "success", 
        "temp_password": temp_password,
        "message": "Contraseña restablecida con éxito."
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
