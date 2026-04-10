from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user, get_current_organization_id
from app.models.user import User
from app.models.team import Team, TeamMembership, TeamInvitation
from app.schemas import teams as schemas
from typing import Any, List
import uuid
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/", response_model=List[schemas.Team])
def get_teams(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_organization_id)
) -> Any:
    return db.query(Team).filter(Team.organization_id == org_id).all()

@router.get("/{team_id}/members", response_model=List[schemas.TeamMemberOut])
def get_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_organization_id)
) -> Any:
    team = db.query(Team).filter(Team.id == team_id, Team.organization_id == org_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
        
    memberships = db.query(TeamMembership).filter(TeamMembership.team_id == team_id).all()
    results = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            results.append(schemas.TeamMemberOut(
                user_id=user.id,
                team_id=team_id,
                role=m.role,
                joined_at=m.joined_at,
                email=user.email,
                full_name=user.full_name
            ))
    return results

@router.patch("/members/{user_id}")
def update_team_member_role(
    user_id: int,
    data: schemas.TeamRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Permiso denegado para modificar roles")
        
    membership = db.query(TeamMembership).join(Team).filter(
        TeamMembership.user_id == user_id,
        Team.organization_id == current_user.organization_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Miembro no encontrado en el equipo")
        
    membership.role = data.role
    db.commit()
    
    # También actualizar rol en tabla users por simplicidad del MVP
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.role = data.role
        db.commit()
        
    return {"status": "ok", "message": "Rol actualizado correctamente"}

@router.post("/{team_id}/invite")
def invite_to_team(
    team_id: int,
    data: schemas.TeamInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Solo líderes pueden invitar")
        
    team = db.query(Team).filter(Team.id == team_id, Team.organization_id == current_user.organization_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
        
    # Crear token (mock invite)
    invite = TeamInvitation(
        team_id=team_id,
        email=data.email,
        token=str(uuid.uuid4()),
        invited_by=current_user.id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(invite)
    db.commit()
    return {"status": "ok", "message": f"Invitación mock enviada a {data.email}"}
