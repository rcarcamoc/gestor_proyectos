from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from .organization import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    leader_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class TeamMembership(Base):
    __tablename__ = "team_memberships"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    role = Column(String(50), default="member") # 'leader', 'member'
    joined_at = Column(DateTime, server_default=func.now())

class TeamInvitation(Base):
    __tablename__ = "team_invitations"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), index=True, nullable=False)
    email = Column(String(255), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
