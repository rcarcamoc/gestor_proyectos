from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, func
from .organization import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    action = Column(String(100), nullable=False) # 'create_project', 'emergency_rollback', etc.
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
