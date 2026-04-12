from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from .organization import Base

class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    
    log_type = Column(String(50), nullable=False) # 'event', 'comment'
    content = Column(Text, nullable=False)
    
    # Para métricas de productividad en cambios de estado
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())

    task = relationship("Task") # Podríamos agregar back_populates si ajustamos Task
    user = relationship("User")
