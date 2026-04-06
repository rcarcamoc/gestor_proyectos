from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import date

class Step1In(BaseModel):
    organization_name: str
    country: str
    team_name: str

class Step2In(BaseModel):
    emails: List[EmailStr]

class Step3In(BaseModel):
    skill_ids: List[int]

class Step4In(BaseModel):
    name: str
    start_date: date
    deadline: Optional[date] = None
    priority: str = "Medium"

class Step5In(BaseModel):
    name: str
    estimated_hours: Optional[float] = None
    assignee_id: Optional[int] = None
