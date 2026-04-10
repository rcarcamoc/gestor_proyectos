from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from app.core.db import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.models.user import User, RefreshToken
from app.models.organization import Organization
from app.schemas.user import UserCreate, Token, LoginRequest, RefreshRequest
import re
from typing import Any

router = APIRouter()

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    # 1. Verificar si el usuario ya existe
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists",
        )

    # 2. Generar y verificar slug de organización único
    org_slug = user_in.organization_name.lower().replace(" ", "-").strip("-")
    org_slug = re.sub(r'[^a-z0-9\-]', '', org_slug)
    if not org_slug:
        org_slug = "org"

    base_slug = org_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == org_slug).first():
        org_slug = f"{base_slug}-{counter}"
        counter += 1

    try:
        # 3. Crear la Organización y obtener su ID via flush
        organization = Organization(
            name=user_in.organization_name,
            slug=org_slug,
            country=user_in.country
        )
        db.add(organization)
        db.flush()  # organization.id queda disponible

        # 4. Crear el Usuario (Owner) con el organization_id ya conocido
        new_user = User(
            organization_id=organization.id,
            email=user_in.email,
            password_hash=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role="owner"
        )
        db.add(new_user)
        db.flush()  # new_user.id queda disponible

        # 4.5 Crear el Equipo por defecto
        from app.models.team import Team, TeamMembership
        team = Team(
            organization_id=organization.id,
            name="Main Team",
            leader_user_id=new_user.id
        )
        db.add(team)
        db.flush()
        
        member = TeamMembership(
            team_id=team.id,
            user_id=new_user.id,
            role="owner"
        )
        db.add(member)

        # 5. Generar tokens (ambos IDs ya están disponibles)
        access_token = create_access_token(
            subject=new_user.email,
            organization_id=organization.id,
            role="owner",
            user_id=new_user.id,
            full_name=new_user.full_name
        )
        refresh_token_str = create_refresh_token(subject=new_user.id)

        # 6. Guardar Refresh Token en BD
        refresh_token_db = RefreshToken(
            user_id=new_user.id,
            token_hash=refresh_token_str,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
        )
        db.add(refresh_token_db)

        # 7. Commit atómico — si algo falla aquí, todo se revierte
        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error creating account: {str(e)}"
        )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
    }

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)) -> Any:
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(
        subject=user.email,
        organization_id=user.organization_id,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name
    )
    refresh_token_str = create_refresh_token(subject=user.id)

    refresh_token_db = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_str,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
    )
    db.add(refresh_token_db)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=Token)
def refresh(refresh_data: RefreshRequest, db: Session = Depends(get_db)) -> Any:
    payload = decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")

    token_db = db.query(RefreshToken).filter(
        RefreshToken.token_hash == refresh_data.refresh_token,
        RefreshToken.revoked_at == None,
        RefreshToken.expires_at > datetime.now()
    ).first()

    if not token_db:
        raise HTTPException(status_code=401, detail="Refresh token not found or revoked")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token_db.revoked_at = datetime.now()

    new_access_token = create_access_token(
        subject=user.email,
        organization_id=user.organization_id,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name
    )
    new_refresh_token_str = create_refresh_token(subject=user.id)

    new_token_db = RefreshToken(
        user_id=user.id,
        token_hash=new_refresh_token_str,
        expires_at=datetime.now() + timedelta(days=30)
    )
    db.add(new_token_db)
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token_str,
        "token_type": "bearer",
    }

@router.post("/logout")
def logout(refresh_data: RefreshRequest, db: Session = Depends(get_db)) -> Any:
    token_db = db.query(RefreshToken).filter(
        RefreshToken.token_hash == refresh_data.refresh_token
    ).first()
    if token_db:
        token_db.revoked_at = datetime.now()
        db.commit()
    return {"message": "Logged out successfully"}
