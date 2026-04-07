from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user, get_current_organization_id
from app.models.user import User
from app.models.project import Project
from app.schemas import projects as schemas
from typing import Any, List

router = APIRouter()

@router.get("/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_organization_id)
) -> Any:
    return db.query(Project).filter(Project.organization_id == org_id).all()

@router.post("/", response_model=schemas.Project)
def create_project(
    data: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear proyectos")

    project = Project(
        **data.model_dump(),
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("/{project_id}", response_model=schemas.Project)
def read_project(
    project_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_organization_id)
) -> Any:
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == org_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project

@router.patch("/{project_id}", response_model=schemas.Project)
def update_project(
    project_id: int,
    data: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar proyectos")

    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(project, key, val)
    db.commit()
    db.refresh(project)
    return project
