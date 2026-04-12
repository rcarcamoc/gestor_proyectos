from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, onboarding, projects, tasks, engine, time_tracking as time, dashboard, emergency, skills, teams, task_logs, notifications
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/openapi.json"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.db.session import engine
from sqlalchemy import text

@app.on_event("startup")
def run_migrations():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN color VARCHAR(50) NULL AFTER created_at"))
            print("Columna 'color' agregada a projects.")
        except Exception:
            pass # Ya existe
        
        try:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN completed_at DATETIME NULL AFTER created_at"))
            print("Columna 'completed_at' agregada a tasks.")
        except Exception:
            pass # Ya existe


# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(engine.router, prefix="/engine", tags=["engine"])
app.include_router(time.router, prefix="/time", tags=["time"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(emergency.router, prefix="/emergency", tags=["emergency"])
app.include_router(skills.router, prefix="/skills", tags=["skills"])
app.include_router(teams.router, prefix="/teams", tags=["teams"])
app.include_router(task_logs.router, prefix="/task_logs", tags=["task_logs"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
@app.get("/health")
def health_check():
    return {"status": "ok", "version": settings.VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
