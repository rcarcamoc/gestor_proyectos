from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user, get_current_organization_id
from app.models.user import User
from app.models.task import Task, TaskMetric
from app.models.project import Project
from app.schemas import tasks as schemas
from typing import Any, List, Optional

router = APIRouter()

@router.get("/", response_model=List[schemas.Task])
def read_tasks(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_organization_id)
) -> Any:
    # Verificamos proyecto pertenezca a la org si se proporciona
    query = db.query(Task).join(Project).filter(Project.organization_id == org_id)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    return query.all()

@router.post("/", response_model=schemas.Task)
def create_task(
    data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    from app.services.engine import SmartEngine
    from app.models.task import TaskAssignment

    # Verificar proyecto pertenezca a la organización
    project = db.query(Project).filter(Project.id == data.project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado en esta organización")

    task_data = data.model_dump(exclude={'assignee_id'})
    task = Task(
        **task_data,
        created_by=current_user.id
    )
    db.add(task)
    db.flush()

    warning = None
    if data.assignee_id:
        # Evaluate engine impact
        engine = SmartEngine(db)
        warning = engine.check_cross_project_impact(
            user_id=data.assignee_id,
            estimated_hours=data.estimated_hours or 0,
            start_date=data.start_date,
            deadline=data.deadline
        )
        # Assing user
        assignment = TaskAssignment(task_id=task.id, user_id=data.assignee_id, assigned_by=current_user.id)
        db.add(assignment)

    # Inicializar métricas
    metric = TaskMetric(
        task_id=task.id,
        estimated_hours=task.estimated_hours or 0.0
    )
    db.add(metric)

    # Bitácora: Registro de creación
    from app.models.task_log import TaskLog
    db.add(TaskLog(
        task_id=task.id, 
        user_id=current_user.id, 
        log_type="event", 
        content=f"Tarea creada por {current_user.full_name}",
        new_status=task.status
    ))

    db.commit()
    db.refresh(task)
    
    # Inject warning into the returned response manually since it's not a column
    setattr(task, "cross_project_warning", warning)
    return task

@router.get("/{task_id}", response_model=schemas.Task)
def read_task(
    task_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_organization_id)
) -> Any:
    task = db.query(Task).join(Project).filter(Task.id == task_id, Project.organization_id == org_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return task

@router.patch("/{task_id}", response_model=schemas.Task)
def update_task(
    task_id: int,
    data: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    from app.services.engine import SmartEngine
    from app.models.task import TaskAssignment
    
    task = db.query(Task).join(Project).filter(Task.id == task_id, Project.organization_id == current_user.organization_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    old_status = task.status
    task_data = data.model_dump(exclude_unset=True, exclude={'assignee_id'})
    for key, val in task_data.items():
        setattr(task, key, val)
        # Actualizar métricas si cambian horas
        if key in ["estimated_hours", "actual_hours"]:
            metric = db.query(TaskMetric).filter(TaskMetric.task_id == task.id).first()
            if metric:
                setattr(metric, key, val)
                metric.variance_hours = metric.actual_hours - (metric.estimated_hours or 0)
                if metric.estimated_hours and metric.estimated_hours > 0:
                    metric.variance_percent = (metric.variance_hours / metric.estimated_hours) * 100

    warning = None
    if data.assignee_id is not None:
        # Check if assignment actually changes or we just evaluate
        assignment = db.query(TaskAssignment).filter(TaskAssignment.task_id == task.id).first()
        if assignment:
            assignment.user_id = data.assignee_id
        else:
            assignment = TaskAssignment(task_id=task.id, user_id=data.assignee_id, assigned_by=current_user.id)
            db.add(assignment)
            
    # Check impact if any relevant field was touched
    assignment = db.query(TaskAssignment).filter(TaskAssignment.task_id == task.id).first()
    
    # Bitácora automática si cambia el estado
    if "status" in task_data and task_data["status"] != old_status:
        from app.models.task_log import TaskLog
        db.add(TaskLog(
            task_id=task.id,
            user_id=current_user.id,
            log_type="event",
            content=f"Estado cambiado de {old_status} a {task_data['status']}",
            old_status=old_status,
            new_status=task_data["status"]
        ))
        
        # Alerta al líder/owner si se bloquea
        if task_data["status"] == "Blocked":
            from app.models.notification import Notification
            # Notificar al owner del proyecto
            notif = Notification(
                user_id=project.created_by,
                type="block",
                message=f"BLOQUEO: La tarea '{task.name}' ha sido bloqueada por {current_user.full_name}",
                link="/tasks"
            )
            db.add(notif)

    if assignment and (data.assignee_id is not None or "estimated_hours" in task_data or "start_date" in task_data or "deadline" in task_data):
        engine = SmartEngine(db)
        warning = engine.check_cross_project_impact(
            user_id=assignment.user_id,
            estimated_hours=task.estimated_hours or 0,
            start_date=task.start_date,
            deadline=task.deadline,
            exclude_task_id=task.id
        )

    db.commit()
    db.refresh(task)
    setattr(task, "cross_project_warning", warning)
    return task
