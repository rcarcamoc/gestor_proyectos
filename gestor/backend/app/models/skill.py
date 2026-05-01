from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func
from .organization import Base

class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(100), nullable=True) # 'Backend', 'Frontend', etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class UserSkill(Base):
    __tablename__ = "user_skills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), index=True, nullable=False)
    level = Column(String(50)) # 'basic', 'intermediate', 'advanced', 'expert'
    source = Column(String(50)) # 'self_declared', 'leader_validated'
    validated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)
