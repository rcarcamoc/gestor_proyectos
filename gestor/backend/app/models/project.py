from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, func
from sqlalchemy.orm import relationship
from .organization import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    priority = Column(String(50), default="Medium") # 'Critical', 'High', 'Medium', 'Low'
    status = Column(String(50), default="Planned") # 'Planned', 'In Progress', 'Completed', 'Archived'
    start_date = Column(Date, nullable=False)
    deadline = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    color = Column(String(50), nullable=True) # Almacena clase de Tailwind o Hex

    tasks = relationship("Task", back_populates="project")
