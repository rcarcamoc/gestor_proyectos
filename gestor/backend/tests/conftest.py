import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.db import get_db

# Import models to ensure they're registered before create_all
from app.models.organization import Base
from app.models.user import User, RefreshToken
from app.models.team import Team, TeamMembership, TeamInvitation
from app.models.project import Project
from app.models.task import Task, TaskAssignment, TaskDependency, TaskMetric
from app.models.skill import Skill, UserSkill
from app.models.availability import UserAvailability, Absence
from app.models.holiday import Holiday
from app.models.time import TimeEntry
from app.models.emergency import EmergencyPlan, EmergencySnapshot, EmergencyActionLog
from app.models.audit import AuditLog
from app.models.config import SystemConfig

# SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test case."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Dependency override for test client."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
