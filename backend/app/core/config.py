from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartTrack"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    
    JWT_SECRET: str
    JWT_EXPIRY: int  # minutos
    
    FRONTEND_URL: str
    BACKEND_URL: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
