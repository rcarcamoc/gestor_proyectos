from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotificationBase(BaseModel):
    user_id: int
    type: str # 'mention', 'block', 'assignment'
    message: str
    link: Optional[str] = None
    is_read: bool = False

class NotificationCreate(NotificationBase):
    pass

class NotificationUpdate(BaseModel):
    is_read: bool

class Notification(NotificationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
