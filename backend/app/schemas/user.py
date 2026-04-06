from pydantic import BaseModel, EmailStr
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str
    organization_name: str
    country: Optional[str] = "Chile"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

class User(UserBase):
    id: int
    organization_id: int
    role: str
    is_active: bool
    onboarding_completed: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str
