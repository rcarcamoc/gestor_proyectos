from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None

class TeamCreate(TeamBase):
    pass

class Team(TeamBase):
    id: int
    organization_id: int
    leader_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TeamMemberOut(BaseModel):
    user_id: int
    team_id: int
    role: str
    joined_at: datetime
    email: str
    full_name: str
    
    class Config:
        from_attributes = True

class TeamRoleUpdate(BaseModel):
    role: str

class TeamInvite(BaseModel):
    email: EmailStr
    role: Optional[str] = "member"
