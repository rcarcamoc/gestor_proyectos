from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Task, TaskMetric
from app.models.project import Project
from app.models.team import Team, TeamMembership
from app.models.time import TimeEntry
from datetime import datetime, timezone, date
from typing import Any, List

router = APIRouter()

@router.get("/member")
def get_member_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    today = date.today()
    
    # 1. Tareas de hoy
    tasks_today = db.query(Task).join(Project).filter(
        Task.status.in_(["Pending", "In Progress", "Blocked"]),
        Task.start_date <= today
    ).all() # Simplificado para MVP, idealmente filtrar por asignado en task_assignments
    
    # 2. Tareas atrasadas
    overdue_tasks = db.query(Task).filter(
        Task.status.in_(["Pending", "In Progress", "Blocked"]),
        Task.deadline < today
    ).all()
    
    # 3. Timer activo
    active_timer = db.query(TimeEntry).filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.ended_at == None
    ).first()
    
    # 4. Carga proyectada (horas estimadas de tareas activas)
    projected_load = db.query(func.sum(Task.estimated_hours)).filter(
        Task.status.in_(["Pending", "In Progress"])
    ).scalar() or 0.0

    return {
        "tasks_today": tasks_today,
        "overdue_tasks_count": len(overdue_tasks),
        "active_timer": active_timer,
        "projected_load_hours": projected_load,
        "daily_capacity_hours": 8.0 # Configurable en BD
    }

@router.get("/leader")
def get_leader_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    org_id = current_user.organization_id
    
    # 1. Estado global de tareas
    task_stats = db.query(Task.status, func.count(Task.id)).join(Project).filter(
        Project.organization_id == org_id
    ).group_by(Task.status).all()
    
    # 2. Proyectos en riesgo (deadline próximo)
    today = date.today()
    projects_at_risk = db.query(Project).filter(
        Project.organization_id == org_id,
        Project.deadline != None,
        Project.deadline <= today + timedelta(days=7),
        Project.status != "Completed"
    ).all()
    
    # 3. Carga de equipo (Simulado para MVP)
    team_members = db.query(User).filter(User.organization_id == org_id).all()
    team_load = []
    for member in team_members:
        # Aquí iría la lógica del motor para calcular % de carga real
        team_load.append({
            "user_id": member.id,
            "full_name": member.full_name,
            "load_percentage": 75, # Hardcoded para demo
            "status": "Balanced",
            "motor_level": "BASIC" if not member.onboarding_completed else "HIGH"
        })

    return {
        "task_stats": {status: count for status, count in task_stats},
        "projects_at_risk": projects_at_risk,
        "team_load": team_load
    }

from datetime import timedelta
