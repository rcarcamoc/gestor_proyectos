from sqlalchemy.orm import Session, joinedload
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

    # Optimized query with joinedload
    base_query = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.assignments).joinedload(TaskAssignment.user)
    ).join(Project, Task.project_id == Project.id).filter(
        Project.organization_id == org_id,
        or_(
            (Task.start_date <= end) & (Task.deadline >= start),
            Task.start_date == None,
            Task.deadline == None,
            Task.status != "Completed", 
            (Task.status == "Completed") & (Task.completed_at >= (today - timedelta(days=7)))
        )
    )

    if view_mode == "personal":
        base_query = base_query.join(TaskAssignment, Task.id == TaskAssignment.task_id).filter(
            TaskAssignment.user_id == current_user.id
        )

    tasks_data = base_query.all()

    timeline_tasks = []
    for task in tasks_data:
        assignee_data = [{"id": a.user.id, "name": a.user.full_name} for a in task.assignments if a.user]

        timeline_tasks.append({
            "id": task.id,
            "name": task.name,
            "project_id": task.project_id,
            "project_name": task.project.name if task.project else "Unknown",
            "status": task.status,
            "priority": task.priority,
            "start_date": task.start_date.isoformat() if task.start_date else start.isoformat(),
            "deadline": task.deadline.isoformat() if task.deadline else (task.start_date.isoformat() if task.start_date else start.isoformat()),
            "assignees": assignee_data,
            "estimated_hours": task.estimated_hours or 0.0,
            "actual_hours": task.actual_hours or 0.0,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "project_color": task.project.color if task.project and task.project.color else "#3b82f6" 
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
    
    # 1. Tareas de hoy (asignadas al usuario) - Con joinedload para evitar subconsultas si se requiere
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
    overdue_tasks_query = db.query(Task.project_id).join(Project).filter(
        Project.organization_id == org_id,
        Task.status.in_(["Pending", "In Progress"]),
        Task.deadline < today
    ).distinct()
    
    projects_at_risk_ids = {t.project_id for t in blocked_tasks}
    projects_at_risk_ids.update({p[0] for p in overdue_tasks_query.all()})
    projects_at_risk_count = len(projects_at_risk_ids)

    # 3. Team Status (Optimizado pre-calculando carga)
    members = db.query(User).filter(User.organization_id == org_id).all()
    
    # Pre-calcular todas las tareas activas para todos los miembros para evitar N+1
    active_tasks_by_user = {}
    all_active_tasks = db.query(TaskAssignment.user_id, func.sum(Task.estimated_hours)).join(Task).filter(
        Task.status.in_(["Pending", "In Progress"])
    ).group_by(TaskAssignment.user_id).all()
    
    for user_id, total_hours in all_active_tasks:
        active_tasks_by_user[user_id] = total_hours or 0.0

    overloaded = []
    underutilized = []
    
    from app.services.engine import SmartEngine
    engine_service = SmartEngine(db)
    
    for m in members:
        load = active_tasks_by_user.get(m.id, 0.0)
        
        # El motor sigue siendo semi-costoso pero solo se evalúa nivel superficial
        engine_eval = engine_service.evaluate_level(m.id)
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

@router.get("/capacity")
def get_capacity_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    org_id = current_user.organization_id
    
    # 1. Obtener todos los miembros de la organización
    members = db.query(User).filter(User.organization_id == org_id, User.is_active == True).all()
    
    from app.models.availability import UserAvailability
    
    # Pre-fetch availabilities
    availabilities_by_user = {}
    all_avails = db.query(UserAvailability).filter(UserAvailability.user_id.in_([m.id for m in members])).all()
    for a in all_avails:
        if a.user_id not in availabilities_by_user:
            availabilities_by_user[a.user_id] = 0.0
        availabilities_by_user[a.user_id] += float(a.hours_available)

    # Pre-fetch active tasks count and hours
    tasks_info_by_user = {}
    active_tasks = db.query(TaskAssignment.user_id, Task).join(Task).filter(
        Task.status.in_(["Pending", "In Progress"])
    ).all()
    
    for user_id, task in active_tasks:
        if user_id not in tasks_info_by_user:
            tasks_info_by_user[user_id] = {"hours": 0.0, "project_ids": set()}
        tasks_info_by_user[user_id]["hours"] += float(task.estimated_hours or 0.0)
        tasks_info_by_user[user_id]["project_ids"].add(task.project_id)

    # Pre-fetch project names
    all_project_ids = set()
    for info in tasks_info_by_user.values():
        all_project_ids.update(info["project_ids"])
    
    project_names = {p.id: p.name for p in db.query(Project.id, Project.name).filter(Project.id.in_(all_project_ids)).all()} if all_project_ids else {}

    capacity_data = []
    
    for member in members:
        horas_disponibles = availabilities_by_user.get(member.id, 40.0)
        info = tasks_info_by_user.get(member.id, {"hours": 0.0, "project_ids": set()})
        horas_comprometidas = info["hours"]
        names = [project_names[pid] for pid in info["project_ids"] if pid in project_names]
        
        # Porcentaje de carga
        if horas_disponibles > 0:
            porcentaje = (horas_comprometidas / horas_disponibles) * 100
        else:
            porcentaje = 100 if horas_comprometidas > 0 else 0
            
        # Estado de carga
        if porcentaje < 50:
            estado = "LIBRE"
        elif porcentaje <= 80:
            estado = "NORMAL"
        elif porcentaje <= 95:
            estado = "CARGADO"
        else:
            estado = "SOBRECARGADO"
            
        capacity_data.append({
            "id": member.id,
            "name": member.full_name,
            "projects": names,
            "horas_comprometidas": round(horas_comprometidas, 1),
            "horas_disponibles": round(horas_disponibles, 1),
            "porcentaje_carga": round(porcentaje, 1),
            "estado": estado
        })
        
    return capacity_data
