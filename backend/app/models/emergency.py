from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, func
from .organization import Base

class EmergencyPlan(Base):
    __tablename__ = "emergency_plans"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    triggered_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="preview") # 'preview', 'applied', 'rolled_back'
    created_at = Column(DateTime, server_default=func.now())

class EmergencySnapshot(Base):
    __tablename__ = "emergency_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("emergency_plans.id"), index=True, nullable=False)
    snapshot_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class EmergencyActionLog(Base):
    __tablename__ = "emergency_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("emergency_plans.id"), index=True, nullable=False)
    entity_type = Column(String(50)) # 'task', 'project'
    entity_id = Column(Integer)
    change_summary = Column(String(255))
    applied_at = Column(DateTime, server_default=func.now())
