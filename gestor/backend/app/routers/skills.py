from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.skill import Skill, UserSkill
from pydantic import BaseModel
from typing import Any, List, Optional

router = APIRouter()

class SkillOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None

    class Config:
        from_attributes = True

class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None

class UserSkillCreate(BaseModel):
    skill_id: int
    level: str = "intermediate"

class UserSkillOut(BaseModel):
    id: int
    skill_id: int
    skill_name: str
    level: str
    source: str
    validated: bool

    class Config:
        from_attributes = True

@router.get("/", response_model=List[SkillOut])
def list_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(Skill).filter(Skill.is_active == True).order_by(Skill.category, Skill.name).all()

@router.get("/my-skills", response_model=List[UserSkillOut])
def get_my_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    user_skills = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).all()
    results = []
    for us in user_skills:
        skill = db.query(Skill).filter(Skill.id == us.skill_id).first()
        if skill:
            results.append(UserSkillOut(
                id=us.id,
                skill_id=us.skill_id,
                skill_name=skill.name,
                level=us.level,
                source=us.source,
                validated=(us.source == 'leader_validated')
            ))
    return results

@router.post("/my-skills", response_model=UserSkillOut)
def add_my_skill(
    data: UserSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Check if exists
    existing = db.query(UserSkill).filter(
        UserSkill.user_id == current_user.id, 
        UserSkill.skill_id == data.skill_id
    ).first()
    
    if existing:
        existing.level = data.level
        existing.source = "self_declared"
        db.commit()
        db.refresh(existing)
        us = existing
    else:
        us = UserSkill(
            user_id=current_user.id,
            skill_id=data.skill_id,
            level=data.level,
            source="self_declared"
        )
        db.add(us)
        db.commit()
        db.refresh(us)
        
    return UserSkillOut(
        id=us.id,
        skill_id=us.skill_id,
        skill_name=skill.name if skill else "Unknown",
        level=us.level,
        source=us.source,
        validated=False
    )

@router.post("/", response_model=SkillOut)
def create_skill(
    data: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")
        
    skill = Skill(name=data.name, category=data.category)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill

@router.patch("/{skill_id}", response_model=SkillOut)
def update_skill(
    skill_id: int,
    data: SkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")
        
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill no encontrada")
        
    if data.name is not None:
        skill.name = data.name
    if data.category is not None:
        skill.category = data.category
        
    db.commit()
    db.refresh(skill)
    return skill

@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["owner", "leader"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")
        
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill no encontrada")
        
    skill.is_active = False
    db.commit()
    return {"status": "ok"}
