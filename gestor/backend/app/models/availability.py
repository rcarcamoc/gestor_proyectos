from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Float, func
from .organization import Base

class UserAvailability(Base):
    __tablename__ = "user_availability"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0-6 (Lun-Dom)
    hours_available = Column(Float, default=8.0)
    effective_from = Column(Date, nullable=False)

class Absence(Base):
    __tablename__ = "absences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    type = Column(String(50), default="Vacation") # 'Vacation', 'Sick Leave', 'Personal Day'
    notes = Column(String(255), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
