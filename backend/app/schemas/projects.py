from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    priority: str = "Medium"
    status: str = "Planned"
    start_date: date
    deadline: Optional[date] = None
    team_id: int

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    deadline: Optional[date] = None

class Project(ProjectBase):
    id: int
    organization_id: int
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True
