from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user, get_current_organization_id
from app.models.user import User
from app.models.organization import Organization
from app.models.team import Team, TeamMembership
from app.models.project import Project
from app.models.task import Task, TaskMetric
from app.models.skill import UserSkill, Skill
from app.models.holiday import Holiday
from app.schemas import onboarding as schemas
from typing import Any, List
import uuid
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/status")
def get_onboarding_status(current_user: User = Depends(get_current_user)) -> Any:
    return {
        "onboarding_completed": current_user.onboarding_completed,
        "current_step": current_user.onboarding_step or 1
    }

@router.post("/step1")
def onboarding_step1(
    data: schemas.Step1In,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Actualizar organización si cambió nombre o país
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    org.name = data.organization_name
    org.country = data.country

    # Crear el primer equipo
    import string
    import secrets
    link_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    team = Team(
        organization_id=org.id,
        name=data.team_name,
        leader_user_id=current_user.id,
        link_code=link_code
    )
    db.add(team)
    db.flush()

    # Asignar usuario al equipo como líder
    membership = TeamMembership(
        team_id=team.id,
        user_id=current_user.id,
        role="leader"
    )
    db.add(membership)

    user = db.query(User).filter(User.id == current_user.id).first()
    user.onboarding_step = 2

    db.commit()

    return {"status": "ok", "team_id": team.id}

@router.post("/step2/invite")
def onboarding_step2(
    data: schemas.Step2In,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Lógica de invitación (en MVP solo guardamos el registro de intención por ahora)
    # En un sistema real enviaríamos emails con tokens
    user = db.query(User).filter(User.id == current_user.id).first()
    user.onboarding_step = 3
    db.commit()
    return {"status": "ok", "invited_count": len(data.emails)}

@router.post("/step3/skills")
def onboarding_step3(
    data: schemas.Step3In,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    user = db.query(User).filter(User.id == current_user.id).first()
    user.onboarding_step = 4
    for skill_id in data.skill_ids:
        user_skill = UserSkill(
            user_id=current_user.id,
            skill_id=skill_id,
            level="intermediate",
            source="self_declared"
        )
        db.add(user_skill)
    db.commit()
    return {"status": "ok"}

@router.post("/step3/skip")
def onboarding_step3_skip(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    user = db.query(User).filter(User.id == current_user.id).first()
    user.onboarding_step = 4
    db.commit()
    return {"status": "ok"}

@router.post("/step4/project")
def onboarding_step4(
    data: schemas.Step4In,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Obtener el primer equipo creado (obligatorio para crear proyecto)
    team = db.query(Team).filter(Team.organization_id == current_user.organization_id).first()
    if not team:
        raise HTTPException(
            status_code=400,
            detail="Debes completar el paso 1 (crear tu equipo) antes de crear un proyecto."
        )

    project = Project(
        organization_id=current_user.organization_id,
        team_id=team.id,
        name=data.name,
        start_date=data.start_date,
        deadline=data.deadline,
        priority=data.priority,
        created_by=current_user.id
    )
    db.add(project)
    db.flush()  # Para obtener project.id

    user = db.query(User).filter(User.id == current_user.id).first()
    user.onboarding_step = 5

    db.commit()
    db.refresh(project)
    return {"status": "ok", "project_id": project.id}

@router.post("/step5/task")
def onboarding_step5(
    data: schemas.Step5In,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Obtener el proyecto más reciente creado en el paso anterior
    project = db.query(Project).filter(
        Project.organization_id == current_user.organization_id
    ).order_by(Project.id.desc()).first()

    if not project:
        raise HTTPException(
            status_code=400,
            detail="Debes completar el paso 4 (crear un proyecto) primero."
        )

    try:
        # Crear la tarea
        task = Task(
            project_id=project.id,
            name=data.name,
            estimated_hours=data.estimated_hours or 4.0,
            created_by=current_user.id,
            start_date=project.start_date
        )
        db.add(task)
        db.flush()  # task.id disponible

        # Inicializar métricas
        metric = TaskMetric(
            task_id=task.id,
            estimated_hours=task.estimated_hours or 0.0
        )
        db.add(metric)

        # Marcar onboarding como completado
        user = db.query(User).filter(User.id == current_user.id).first()
        user.onboarding_completed = True
        user.onboarding_step = 6

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear tarea: {str(e)}")

    return {
        "status": "ok",
        "motor_confidence": {
            "level": "BASIC",
            "percentage": 55,
            "label": "Estimación inicial",
            "is_estimated": True
        },
        "has_conflicts": False,
        "suggestion": "Todo parece estar en orden para empezar."
    }
