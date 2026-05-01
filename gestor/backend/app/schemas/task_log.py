from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TaskLogBase(BaseModel):
    task_id: int
    log_type: str # 'event', 'comment'
    content: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None

class TaskLogCreate(TaskLogBase):
    pass

class TaskLog(TaskLogBase):
    id: int
    user_id: int
    user_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
