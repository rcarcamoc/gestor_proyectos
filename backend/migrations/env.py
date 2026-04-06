import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Añadir el directorio raíz al sys.path para importar app
sys.path.append(os.getcwd())

from app.core.config import settings
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

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interprete el archivo de configuración para el registro de Python.
# Esta línea configura básicamente a los loggers.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# DB URL from settings
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "pyformat"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
