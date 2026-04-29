"""
Application configuration via environment variables.
Uses pydantic-settings to read from .env file automatically.
"""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # silently ignore unknown .env keys
    )

    # Database
    DATABASE_URL: str = "sqlite:///./finscore.db"

    # JWT
    SECRET_KEY: str = "finscore_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # ML
    ML_MODELS_DIR: str = "./ml_models"

    # LLM (GitHub Models only)
    LLM_PROVIDER: str = "github"  # github
    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "gpt-4.1-mini"
    LLM_BASE_URL: str | None = None
    LLM_FALLBACK_ENABLED: bool = False

    # GitHub Models (OpenAI-compatible API)
    GITHUB_API_KEY: str | None = None
    GITHUB_MODEL: str = "gpt-4.1-mini"

    # OpenAI legacy compatibility
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # LLM (GitHub Models only)
    LLM_PROVIDER: str = "github"  # github
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4.1-mini"
    LLM_BASE_URL: Optional[str] = None
    LLM_FALLBACK_ENABLED: bool = False

    # GitHub Models (OpenAI-compatible API)
    GITHUB_API_KEY: Optional[str] = None
    GITHUB_MODEL: str = "gpt-4.1-mini"

    # OpenAI legacy compatibility
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"


settings = Settings()
