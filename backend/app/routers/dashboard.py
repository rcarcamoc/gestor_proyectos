from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Task, TaskAssignment
from app.models.project import Project
from app.models.team import Team
from app.models.time import TimeEntry
from datetime import datetime, timezone, date, timedelta
from typing import Any, List, Optional

router = APIRouter()

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    view_mode: str = "personal" # "personal" or "team"
) -> Any:
    today = date.today()
    org_id = current_user.organization_id

    # Restrict team view to leaders/owners
    if view_mode == "team" and current_user.role not in ["owner", "leader"]:
        view_mode = "personal"

    # Base query for tasks depending on view_mode
    if view_mode == "personal":
        tasks_query = db.query(Task).join(TaskAssignment).filter(
            TaskAssignment.user_id == current_user.id
        )
    else:
        tasks_query = db.query(Task).join(Project).filter(
            Project.organization_id == org_id
        )

    # Calculate KPIs
    active_projects = db.query(func.count(Project.id)).filter(
        Project.organization_id == org_id,
        Project.status.in_(["Planned", "In Progress"])
    ).scalar() or 0

    pending_tasks = tasks_query.filter(Task.status.in_(["Pending", "In Progress"])).count()
    completed_tasks = tasks_query.filter(Task.status == "Completed").count()
    blocked_tasks = tasks_query.filter(Task.status == "Blocked").count()

    overdue_tasks = tasks_query.filter(
        Task.status.in_(["Pending", "In Progress", "Blocked"]),
        Task.deadline < today
    ).count()

    return {
        "active_projects": active_projects,
        "pending_tasks": pending_tasks,
        "completed_tasks": completed_tasks,
        "blocked_tasks": blocked_tasks,
        "overdue_tasks": overdue_tasks,
        "view_mode": view_mode
    }

@router.get("/timeline")
def get_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    view_mode: str = "personal", # "personal" or "team"
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Any:
    today = date.today()
    start = start_date or (today - timedelta(days=today.weekday())) # Monday
    end = end_date or (start + timedelta(days=14)) # Two weeks view

    org_id = current_user.organization_id

    if view_mode == "team" and current_user.role not in ["owner", "leader"]:
        view_mode = "personal"

    # Fetch tasks that intersect with the given window
    base_query = db.query(Task, Project.name.label("project_name")).join(Project, Task.project_id == Project.id).filter(
        Project.organization_id == org_id,
        Task.start_date <= end,
        Task.deadline >= start
    )

    if view_mode == "personal":
        base_query = base_query.join(TaskAssignment, Task.id == TaskAssignment.task_id).filter(
            TaskAssignment.user_id == current_user.id
        )

    tasks_data = base_query.all()

    timeline_tasks = []
    for task, proj_name in tasks_data:
        # Get assignees
        assignees = db.query(User).join(TaskAssignment).filter(
            TaskAssignment.task_id == task.id
        ).all()

        assignee_data = [{"id": a.id, "name": a.full_name} for a in assignees]

        timeline_tasks.append({
            "id": task.id,
            "name": task.name,
            "project_id": task.project_id,
            "project_name": proj_name,
            "status": task.status,
            "priority": task.priority,
            "start_date": task.start_date.isoformat() if task.start_date else None,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "assignees": assignee_data,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours
        })

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "tasks": timeline_tasks
    }

@router.get("/member")
def get_member_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    today = date.today()
    
    # 1. Tareas de hoy (asignadas al usuario)
    tasks_today = db.query(Task).join(TaskAssignment).filter(
        TaskAssignment.user_id == current_user.id,
        Task.status.in_(["Pending", "In Progress", "Blocked"]),
        Task.start_date <= today,
        or_(Task.deadline >= today, Task.deadline == None)
    ).all()

    # 2. Conteo de tareas atrasadas
    overdue_tasks_count = db.query(Task).join(TaskAssignment).filter(
        TaskAssignment.user_id == current_user.id,
        Task.status.in_(["Pending", "In Progress", "Blocked"]),
        Task.deadline < today
    ).count()

    # 3. Carga proyectada (suma de horas estimadas de tareas activas esta semana)
    # Definimos semana como hoy a +7 días para este MVP
    next_week = today + timedelta(days=7)
    projected_load = db.query(func.sum(Task.estimated_hours)).join(TaskAssignment).filter(
        TaskAssignment.user_id == current_user.id,
        Task.status.in_(["Pending", "In Progress", "Blocked"]),
        Task.deadline >= today,
        Task.deadline <= next_week
    ).scalar() or 0.0

    return {
        "tasks_today": [
            {
                "id": t.id,
                "name": t.name,
                "project_id": t.project_id,
                "status": t.status,
                "priority": t.priority,
                "estimated_hours": t.estimated_hours
            } for t in tasks_today
        ],
        "overdue_tasks_count": overdue_tasks_count,
        "projected_load_hours": float(projected_load),
        "daily_capacity_hours": 8.0 # Default para MVP
    }

@router.get("/leader")
def get_leader_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    today = date.today()
    org_id = current_user.organization_id

    # 1. Blocked Tasks
    blocked_tasks = db.query(Task).join(Project).filter(
        Project.organization_id == org_id,
        Task.status == "Blocked"
    ).all()

    # 2. Projects at risk (at least one blocked task or overdue task)
    projects_at_risk_ids = [t.project_id for t in blocked_tasks]
    overdue_tasks = db.query(Task).join(Project).filter(
        Project.organization_id == org_id,
        Task.status.in_(["Pending", "In Progress"]),
        Task.deadline < today
    ).all()
    projects_at_risk_ids.extend([t.project_id for t in overdue_tasks])
    projects_at_risk_count = len(set(projects_at_risk_ids))

    # 3. Team Status (Overloaded / Underutilized based on active tasks vs capacity)
    members = db.query(User).join(Team, Team.organization_id == org_id).all() # Simplification for MVP
    
    overloaded = []
    underutilized = []
    
    from app.services.engine import SmartEngine
    engine = SmartEngine(db)
    
    for m in members:
        # Evaluate load
        member_tasks = db.query(Task).join(TaskAssignment).filter(
            TaskAssignment.user_id == m.id,
            Task.status.in_(["Pending", "In Progress"])
        ).all()
        
        load = sum([t.estimated_hours or 0.0 for t in member_tasks])
        
        # Engine check for confidence
        engine_eval = engine.evaluate_level(m.id)
        capacity = 8.0 * 5 # MVP static capacity
        
        mem_data = {
            "id": m.id,
            "name": m.full_name,
            "load": load,
            "capacity": capacity,
            "engine_level": engine_eval["level"]
        }
        
        if load > capacity:
            overloaded.append(mem_data)
        elif load < capacity * 0.5:
            underutilized.append(mem_data)

    return {
        "blocked_tasks_count": len(blocked_tasks),
        "projects_at_risk_count": projects_at_risk_count,
        "overloaded_members": overloaded,
        "underutilized_members": underutilized
    }
