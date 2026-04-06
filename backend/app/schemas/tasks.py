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

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    deadline: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

class Task(TaskBase):
    id: int
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True
