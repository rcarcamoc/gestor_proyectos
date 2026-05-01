from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Float, func
from sqlalchemy.orm import relationship
from .organization import Base
import enum

class SkillLevel(str, enum.Enum):
    basic = "basic"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    priority = Column(String(50), default="Medium") # 'Critical', 'High', 'Medium', 'Low'
    status = Column(String(50), default="Pending") # 'Pending', 'In Progress', 'Blocked', 'Completed'
    start_date = Column(Date, nullable=True)
    deadline = Column(Date, nullable=True)
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, default=0.0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    recurrence_type = Column(String(50), default="puntual") # 'puntual', 'diaria', 'semanal', 'mensual'

    project = relationship("Project", back_populates="tasks")
    assignments = relationship("TaskAssignment", back_populates="task")
    dependencies = relationship("TaskDependency", foreign_keys="[TaskDependency.task_id]", back_populates="task")
    required_skills = relationship("TaskRequiredSkill", back_populates="task", cascade="all, delete-orphan")

class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    assigned_at = Column(DateTime, server_default=func.now())
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    task = relationship("Task", back_populates="assignments")
    user = relationship("User", foreign_keys=[user_id])

class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    depends_on_task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    
    task = relationship("Task", foreign_keys=[task_id], back_populates="dependencies")

class TaskRequiredSkill(Base):
    """Skills required to complete a specific task. Enables real skill matching in the AI engine."""
    __tablename__ = "task_required_skills"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), index=True, nullable=False)
    # Minimum proficiency level the assignee should have
    min_level = Column(String(50), default="basic")  # 'basic', 'intermediate', 'advanced', 'expert'

    task = relationship("Task", back_populates="required_skills")
    skill = relationship("Skill")


class TaskMetric(Base):
    __tablename__ = "task_metrics"

    task_id = Column(Integer, ForeignKey("tasks.id"), primary_key=True)
    estimated_hours = Column(Float, default=0.0)
    actual_hours = Column(Float, default=0.0)
    variance_hours = Column(Float, default=0.0)
    variance_percent = Column(Float, default=0.0)
    updated_at = Column(DateTime, onupdate=func.now())
