from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class EmergencyPreviewIn(BaseModel):
    reason: str

class EmergencyActionLog(BaseModel):
    task_id: int
    old_start_date: Optional[str]
    new_start_date: Optional[str]
    old_deadline: Optional[str]
    new_deadline: Optional[str]

class EmergencyPreviewOut(BaseModel):
    plan_id: int
    affected_tasks_count: int
    affected_projects_count: int
    changes: List[Any]
    impact_summary: str

class EmergencyApplyIn(BaseModel):
    plan_id: int
