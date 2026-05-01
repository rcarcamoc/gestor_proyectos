from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: int
    priority: str = "Medium"
    status: str = "Pending"
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = 0.0
    completed_at: Optional[datetime] = None
    recurrence_type: str = "puntual" # 'puntual', 'diaria', 'semanal', 'mensual'

class TaskCreate(TaskBase):
    assignee_id: Optional[int] = None

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    assignee_id: Optional[int] = None
    recurrence_type: Optional[str] = None

class Task(TaskBase):
    id: int
    created_by: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    cross_project_warning: Optional[dict] = None

    class Config:
        from_attributes = True
