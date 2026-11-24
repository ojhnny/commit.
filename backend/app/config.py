from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/commit"
    # Comma-separated list of web origins allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Set to false once your account exists so nobody else can sign up.
    allow_signup: bool = True
    session_days: int = 60

    @property
    def sqlalchemy_url(self) -> str:
        # Hosts like Neon/Render hand out postgres:// or postgresql:// URLs; use the psycopg 3 driver.
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
