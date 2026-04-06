from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, func
from .organization import Base

class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0)
    source = Column(String(50), default="timer") # 'timer', 'manual'
    notes = Column(Text, nullable=True)
