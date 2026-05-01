from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from typing import Generator
from sqlalchemy import create_engine

# MySQL connection URL
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_recycle=280,      # Recicla conexiones cada ~4.5 min (MySQL cierra a los 8)
    pool_pre_ping=True,    # Verifica la conexión antes de usarla
    pool_size=5,
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
