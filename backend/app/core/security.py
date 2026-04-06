from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
from app.core.config import settings
from .security_simple import get_password_hash as hash_pwd, verify_password as verify_pwd

ALGORITHM = "HS256"

def create_access_token(
    subject: Union[str, Any],
    organization_id: int,
    role: str,
    user_id: int,
    full_name: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY)

    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "user_id": user_id,
        "organization_id": organization_id,
        "full_name": full_name,
        "role": role
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=30)

    to_encode = {"sub": str(subject), "exp": expire, "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return verify_pwd(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return hash_pwd(password)

def decode_token(token: str) -> dict:
    try:
        decoded_token = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return decoded_token
    except JWTError:
        return None
