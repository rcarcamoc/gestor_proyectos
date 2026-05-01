import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine as db_engine
from app.models.organization import Base
from app.routers import (
    auth, onboarding, projects, tasks, engine, dashboard,
    emergency, skills, teams, task_logs, notifications, telegram, assistant,
    telegram_chat,
    time_tracking as time,
)

logger_main = logging.getLogger("startup")


# ---------------------------------------------------------------------------
# BUG 17 FIX: startup con lifespan context manager (on_event está deprecado)
# BUG 18 FIX: distinguir "columna ya existe" de errores reales en migraciones
# ---------------------------------------------------------------------------

def _is_duplicate_column(e: Exception) -> bool:
    """True si el error indica que la columna ya existe (migración ya aplicada)."""
    msg = str(e).lower()
    return "duplicate column" in msg or "already exists" in msg


def _run_startup_migrations():
    try:
        logger_main.info("Iniciando creación de tablas...")
        Base.metadata.create_all(bind=db_engine)
        logger_main.info("Tablas creadas/verificadas exitosamente.")
    except Exception as e:
        logger_main.error(f"Error creando tablas: {e}")

    migrations = [
        "ALTER TABLE projects ADD COLUMN color VARCHAR(50) NULL AFTER created_at",
        "ALTER TABLE tasks ADD COLUMN completed_at DATETIME NULL AFTER created_at",
        "ALTER TABLE tasks ADD COLUMN recurrence_type VARCHAR(50) DEFAULT 'puntual' AFTER completed_at",
        "ALTER TABLE teams ADD COLUMN telegram_chat_id VARCHAR(100) NULL AFTER leader_user_id",
        "ALTER TABLE teams ADD COLUMN link_code VARCHAR(20) NULL AFTER telegram_chat_id",
    ]
    with db_engine.begin() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                logger_main.info(f"Migración aplicada: {sql[:60]}...")
            except Exception as e:
                if _is_duplicate_column(e):
                    pass  # Ya existe — comportamiento esperado en reinicios
                else:
                    logger_main.error(f"Error inesperado en migración [{sql[:60]}...]: {e}")


from app.services.tools import register_all_tools

@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_startup_migrations()
    register_all_tools()
    yield
    # (lógica de shutdown si se necesita en el futuro)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,          prefix="/auth",          tags=["auth"])
app.include_router(onboarding.router,    prefix="/onboarding",    tags=["onboarding"])
app.include_router(projects.router,      prefix="/projects",      tags=["projects"])
app.include_router(tasks.router,         prefix="/tasks",         tags=["tasks"])
app.include_router(engine.router,        prefix="/engine",        tags=["engine"])
app.include_router(time.router,          prefix="/time",          tags=["time"])
app.include_router(dashboard.router,     prefix="/dashboard",     tags=["dashboard"])
app.include_router(emergency.router,     prefix="/emergency",     tags=["emergency"])
app.include_router(skills.router,        prefix="/skills",        tags=["skills"])
app.include_router(teams.router,         prefix="/teams",         tags=["teams"])
app.include_router(task_logs.router,     prefix="/task_logs",     tags=["task_logs"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(telegram.router,      prefix="/telegram",      tags=["telegram"])
app.include_router(telegram_chat.router, prefix="/telegram",      tags=["telegram_chat"])
app.include_router(assistant.router,     prefix="/assistant",     tags=["assistant"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": settings.VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
