"""Environment-driven application settings."""
from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRETS = {
    "",
    "change-me",
    "dev-secret-change-me",
    "test-secret",
    "change-me-in-production-please-use-a-long-random-string",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "MemeShare"
    environment: str = "development"
    debug: bool = True
    # Echo every SQL statement (noisy, may print parameter values) — opt-in.
    sql_echo: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database — SQLite for local dev; swap for postgresql+asyncpg://... in production
    database_url: str = "sqlite+aiosqlite:///./memeshare.db"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # CORS — comma-separated string in the env; use `.cors_origin_list` in code.
    cors_origins: str = Field(
        default="http://localhost:5174,http://127.0.0.1:5174",
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )

    # Storage
    storage_backend: str = "local"
    local_storage_dir: str = "media_store"
    local_storage_public_url: str = "http://localhost:8000/media"
    s3_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_bucket: str = "memeshare-media"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_public_url: str | None = None

    # Upload limits
    max_image_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 50 * 1024 * 1024
    # Hard ceiling checked from Content-Length before the body is buffered.
    max_request_bytes: int = 64 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @model_validator(mode="after")
    def _normalize_database_url(self) -> Settings:
        """Accept the plain ``postgresql://`` / ``postgres://`` URLs that managed
        hosts (Render, Heroku, …) hand out and rewrite them to the async driver
        this app talks to. Also drop libpq-only query params (``sslmode``,
        ``channel_binding``) that asyncpg rejects — use a same-region internal
        DB URL, which needs neither."""
        url = self.database_url
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                url = "postgresql+asyncpg://" + url[len(prefix) :]
                break
        if url.startswith("postgresql+asyncpg://") and "?" in url:
            base, _, query = url.partition("?")
            kept = [
                kv
                for kv in query.split("&")
                if kv and kv.split("=", 1)[0] not in {"sslmode", "channel_binding"}
            ]
            url = base + ("?" + "&".join(kept) if kept else "")
        self.database_url = url
        return self

    @model_validator(mode="after")
    def _guard_production(self) -> Settings:
        if self.is_production:
            if self.jwt_secret in _PLACEHOLDER_SECRETS or len(self.jwt_secret) < 32:
                raise ValueError(
                    "JWT_SECRET must be a strong, non-default value (>=32 chars) in production"
                )
            if self.debug:
                raise ValueError("DEBUG must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
