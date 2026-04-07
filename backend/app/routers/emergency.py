from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user, get_current_organization_id
from app.models.user import User
from app.models.task import Task
from app.models.project import Project
from app.models.emergency import EmergencyPlan, EmergencySnapshot, EmergencyActionLog
from app.models.config import SystemConfig
from app.schemas import emergency as schemas
from typing import Any, List
import json
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.post("/preview", response_model=schemas.EmergencyPreviewOut)
def create_emergency_preview(
    data: schemas.EmergencyPreviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")

    # 1. Analizar impacto (Simulación MVP)
    # Buscamos todas las tareas activas de la organización
    tasks = db.query(Task).join(Project).filter(
        Project.organization_id == current_user.organization_id,
        Task.status.in_(["Pending", "In Progress"])
    ).all()

    # Proponemos mover todas las tareas 1 semana (Simulación)
    changes = []
    for t in tasks:
        if t.start_date:
            changes.append({
                "task_id": t.id,
                "task_name": t.name,
                "old_start_date": str(t.start_date),
                "new_start_date": str(t.start_date + timedelta(days=7))
            })

    plan = EmergencyPlan(
        organization_id=current_user.organization_id,
        triggered_by=current_user.id,
        reason=data.reason,
        status="preview"
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    return {
        "plan_id": plan.id,
        "affected_tasks_count": len(tasks),
        "affected_projects_count": 1, # Demo
        "changes": changes,
        "impact_summary": f"La emergencia '{data.reason}' afectará a {len(tasks)} tareas activas."
    }

@router.post("/apply")
def apply_emergency_plan(
    data: schemas.EmergencyApplyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    plan = db.query(EmergencyPlan).filter(EmergencyPlan.id == data.plan_id).first()
    if not plan or plan.status != "preview":
        raise HTTPException(status_code=404, detail="Plan no encontrado o ya aplicado")

    # 1. Crear Snapshot antes de aplicar cambios
    tasks = db.query(Task).join(Project).filter(
        Project.organization_id == current_user.organization_id,
        Task.status.in_(["Pending", "In Progress"])
    ).all()

    snapshot_data = []
    for t in tasks:
        snapshot_data.append({
            "id": t.id,
            "start_date": str(t.start_date) if t.start_date else None,
            "deadline": str(t.deadline) if t.deadline else None,
            "status": t.status
        })

    snapshot = EmergencySnapshot(
        plan_id=plan.id,
        snapshot_json=snapshot_data
    )
    db.add(snapshot)

    # 2. Aplicar cambios (Simulación: Mover 7 días)
    for t in tasks:
        if t.start_date:
            t.start_date = t.start_date + timedelta(days=7)
        if t.deadline:
            t.deadline = t.deadline + timedelta(days=7)

        log = EmergencyActionLog(
            plan_id=plan.id,
            entity_type="task",
            entity_id=t.id,
            change_summary="Postpuesto 7 días por emergencia"
        )
        db.add(log)

    plan.status = "applied"
    db.commit()

    return {"status": "ok", "message": "Plan de emergencia aplicado correctamente"}

@router.post("/rollback/{plan_id}")
def rollback_emergency(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    plan = db.query(EmergencyPlan).filter(EmergencyPlan.id == plan_id).first()
    if not plan or plan.status != "applied":
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    # 1. Verificar ventana de rollback
    rollback_window_hours = db.query(SystemConfig).filter(SystemConfig.key == "emergency_rollback_window_hours").first()
    window = int(rollback_window_hours.value if rollback_window_hours else 2)

    if datetime.now(timezone.utc) > plan.created_at.replace(tzinfo=timezone.utc) + timedelta(hours=window):
        raise HTTPException(status_code=409, detail="La ventana de rollback ha expirado (2h).")

    # 2. Revertir cambios usando el snapshot
    snapshot = db.query(EmergencySnapshot).filter(EmergencySnapshot.plan_id == plan.id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot no encontrado")

    for task_data in snapshot.snapshot_json:
        task = db.query(Task).filter(Task.id == task_data["id"]).first()
        if task:
            task.start_date = datetime.strptime(task_data["start_date"], "%Y-%m-%d").date() if task_data["start_date"] else None
            task.deadline = datetime.strptime(task_data["deadline"], "%Y-%m-%d").date() if task_data["deadline"] else None
            task.status = task_data["status"]

    plan.status = "rolled_back"
    db.commit()

    return {"status": "ok", "message": "Rollback ejecutado con éxito"}
