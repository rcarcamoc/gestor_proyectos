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
    # Verificar proyecto pertenezca a la organización
    project = db.query(Project).filter(Project.id == data.project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado en esta organización")

    task = Task(
        **data.model_dump(),
        created_by=current_user.id
    )
    db.add(task)
    db.flush()

    # Inicializar métricas
    metric = TaskMetric(
        task_id=task.id,
        estimated_hours=task.estimated_hours or 0.0
    )
    db.add(metric)
    db.commit()
    db.refresh(task)
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
    task = db.query(Task).join(Project).filter(Task.id == task_id, Project.organization_id == current_user.organization_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(task, key, val)
        # Actualizar métricas si cambian horas
        if key in ["estimated_hours", "actual_hours"]:
            metric = db.query(TaskMetric).filter(TaskMetric.task_id == task.id).first()
            if metric:
                setattr(metric, key, val)
                metric.variance_hours = metric.actual_hours - (metric.estimated_hours or 0)
                if metric.estimated_hours and metric.estimated_hours > 0:
                    metric.variance_percent = (metric.variance_hours / metric.estimated_hours) * 100

    db.commit()
    db.refresh(task)
    return task
