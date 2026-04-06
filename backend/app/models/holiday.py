from sqlalchemy import Column, Integer, String, Date, Boolean, func
from .organization import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(5), index=True, nullable=False) # 'CL'
    date = Column(Date, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    is_recurring = Column(Boolean, default=True)
