from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    country = Column(String(50), default="Chile")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
