from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from typing import Generator
from sqlalchemy import create_engine

# MySQL 8.4 connection
SQLALCHEMY_DATABASE_URL = "sqlite:///../temp.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
