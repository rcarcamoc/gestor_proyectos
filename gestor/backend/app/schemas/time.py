from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TimeEntryBase(BaseModel):
    task_id: int
    notes: Optional[str] = None

class TimeEntryCreate(TimeEntryBase):
    started_at: datetime
    ended_at: datetime
    duration_minutes: Optional[int] = None

class TimeEntryManual(TimeEntryBase):
    duration_minutes: int
    started_at: Optional[datetime] = None

class TimeEntryResponse(TimeEntryBase):
    id: int
    user_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: int
    source: str

    class Config:
        from_attributes = True
