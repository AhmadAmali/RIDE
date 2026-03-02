from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    database_url: str = "postgresql+asyncpg://ride:ride@localhost:5432/ride"

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"

    # API
    cors_origins: list[str] = ["http://localhost:3000"]
    api_host: str = "0.0.0.0"
    api_port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
