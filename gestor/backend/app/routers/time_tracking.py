from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.time import TimeEntry
from app.models.task import Task, TaskMetric
from app.schemas import time as schemas
from typing import Any, List, Optional
from datetime import datetime, timezone

router = APIRouter()

# IMPORTANTE: /active-timer debe ir ANTES de /{task_id}
@router.get("/active-timer", response_model=Optional[schemas.TimeEntryResponse])
def get_active_timer(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(TimeEntry).filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.ended_at == None
    ).first()

@router.get("/{task_id}", response_model=List[schemas.TimeEntryResponse])
def get_task_time_entries(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(TimeEntry).filter(TimeEntry.task_id == task_id).all()

@router.post("/start/{task_id}")
def start_timer(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    active_timer = db.query(TimeEntry).filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.ended_at == None
    ).first()
    if active_timer:
        raise HTTPException(status_code=409, detail="Ya tienes un timer activo en otra tarea.")

    entry = TimeEntry(
        task_id=task_id,
        user_id=current_user.id,
        started_at=datetime.now(timezone.utc).replace(tzinfo=None),
        source="timer"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"status": "ok", "entry_id": entry.id}

@router.post("/stop")
def stop_timer(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    entry = db.query(TimeEntry).filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.ended_at == None
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="No hay timer activo.")

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    entry.ended_at = now_naive
    delta = entry.ended_at - entry.started_at
    entry.duration_minutes = int(delta.total_seconds() / 60)

    metric = db.query(TaskMetric).filter(TaskMetric.task_id == entry.task_id).first()
    if metric:
        metric.actual_hours = (metric.actual_hours or 0.0) + entry.duration_minutes / 60
        estimated = metric.estimated_hours or 0.0
        metric.variance_hours = metric.actual_hours - estimated
        if estimated > 0:
            metric.variance_percent = (metric.variance_hours / estimated) * 100

    db.commit()
    return {"status": "ok", "duration_minutes": entry.duration_minutes}

@router.post("/log-manual", response_model=schemas.TimeEntryResponse)
def log_manual(
    data: schemas.TimeEntryManual,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    started = data.started_at.replace(tzinfo=None) if data.started_at else now_naive

    entry = TimeEntry(
        task_id=data.task_id,
        user_id=current_user.id,
        started_at=started,
        ended_at=now_naive,
        duration_minutes=data.duration_minutes,
        source="manual",
        notes=data.notes
    )
    db.add(entry)

    metric = db.query(TaskMetric).filter(TaskMetric.task_id == data.task_id).first()
    if metric:
        metric.actual_hours = (metric.actual_hours or 0.0) + data.duration_minutes / 60
        estimated = metric.estimated_hours or 0.0
        metric.variance_hours = metric.actual_hours - estimated
        if estimated > 0:
            metric.variance_percent = (metric.variance_hours / estimated) * 100

    db.commit()
    db.refresh(entry)
    return entry
