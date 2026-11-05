from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+asyncpg://minicrm:minicrm@localhost:5432/minicrm"
    jwt_secret: str = Field(min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    frontend_origin: str = "http://localhost:5173"
    cookie_secure: bool = False


@lru_cache
def get_settings():
    return Settings()
