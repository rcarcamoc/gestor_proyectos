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

class UserSkillCreate(BaseModel):
    skill_id: int
    level: str = "intermediate"

@router.get("/", response_model=List[SkillOut])
def list_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(Skill).filter(Skill.is_active == True).order_by(Skill.category, Skill.name).all()

@router.get("/my-skills", response_model=List[SkillOut])
def get_my_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    user_skills = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).all()
    skill_ids = [us.skill_id for us in user_skills]
    return db.query(Skill).filter(Skill.id.in_(skill_ids)).all()
