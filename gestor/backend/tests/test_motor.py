from app.services.engine import SmartEngine
from app.models.user import User
from app.models.skill import UserSkill, Skill
from app.models.availability import UserAvailability
from app.models.task import Task
from app.models.project import Project
from app.models.organization import Organization
from app.models.config import SystemConfig
from datetime import date

def test_motor_level_degraded(db_session):
    # Setup
    org = Organization(name="Test Org", slug="test-org")
    db_session.add(org)
    db_session.flush()

    user = User(full_name="Usuario Sin Datos", email="degraded@test.com", password_hash="123", organization_id=org.id)
    db_session.add(user)
    db_session.commit()

    engine = SmartEngine(db_session)
    result = engine.evaluate_level(user.id)
    assert result["level"] == "DEGRADED"
    assert result["percentage"] == 30

def test_motor_level_basic(db_session):
    org = Organization(name="Test Org", slug="test-org-basic")
    db_session.add(org)
    db_session.flush()

    user = User(full_name="Usuario Basic", email="basic@test.com", password_hash="123", organization_id=org.id)
    db_session.add(user)
    db_session.flush()

    # Le damos Availability pero no skills ni history
    avail = UserAvailability(user_id=user.id, day_of_week=1, hours_available=8.0)
    db_session.add(avail)
    db_session.commit()

    engine = SmartEngine(db_session)
    result = engine.evaluate_level(user.id)
    assert result["level"] == "BASIC"
    assert result["percentage"] == 55

def test_motor_level_full(db_session):
    org = Organization(name="Test Org", slug="test-org-full")
    db_session.add(org)
    db_session.flush()

    user = User(full_name="Usuario Full", email="full@test.com", password_hash="123", organization_id=org.id)
    db_session.add(user)
    db_session.flush()

    # Availability
    avail = UserAvailability(user_id=user.id, day_of_week=1, hours_available=8.0)
    db_session.add(avail)

    # Skills
    skill = Skill(name="Python", organization_id=org.id)
    db_session.add(skill)
    db_session.flush()
    uskill = UserSkill(user_id=user.id, skill_id=skill.id)
    db_session.add(uskill)

    # History (Completed Task)
    proj = Project(name="Project 1", organization_id=org.id)
    db_session.add(proj)
    db_session.flush()
    task = Task(name="Task 1", project_id=proj.id, status="Completed")
    db_session.add(task)
    db_session.commit()

    engine = SmartEngine(db_session)
    result = engine.evaluate_level(user.id)
    
    # We added avail, skills, history. It should be FULL.
    assert result["level"] == "FULL"
    assert result["percentage"] == 95

def test_defaults_from_db(db_session):
    # Setup custom configs
    db_session.add(SystemConfig(key="engine_basic_hours_per_day", value="10"))
    db_session.add(SystemConfig(key="engine_default_task_hours", value="5"))
    db_session.commit()

    engine = SmartEngine(db_session)
    assert float(engine.configs.get("engine_basic_hours_per_day")) == 10.0
    assert float(engine.configs.get("engine_default_task_hours")) == 5.0
