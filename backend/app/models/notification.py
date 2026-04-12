from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from .organization import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    
    type = Column(String(50), nullable=False) # 'mention', 'block', 'assignment'
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True) # URL to the related entity
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")
