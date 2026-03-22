from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="local", alias="APP_ENV")
    api_host: str = Field(default="127.0.0.1", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/timetracker42",
        alias="DATABASE_URL",
    )

    jwt_secret: str = Field(default="dev-change-me", alias="JWT_SECRET")
    jwt_access_ttl_minutes: int = Field(default=15, alias="JWT_ACCESS_TTL_MINUTES")
    jwt_refresh_ttl_days: int = Field(default=30, alias="JWT_REFRESH_TTL_DAYS")

    token_encryption_key: str = Field(default="dev-change-me", alias="TOKEN_ENCRYPTION_KEY")

    fortytwo_client_id: str = Field(default="change_me", alias="FORTYTWO_CLIENT_ID")
    fortytwo_client_secret: str = Field(default="change_me", alias="FORTYTWO_CLIENT_SECRET")
    fortytwo_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/auth/42/callback",
        alias="FORTYTWO_REDIRECT_URI",
    )
    fortytwo_oauth_authorize_url: str = Field(
        default="https://api.intra.42.fr/oauth/authorize",
        alias="FORTYTWO_OAUTH_AUTHORIZE_URL",
    )
    fortytwo_oauth_token_url: str = Field(
        default="https://api.intra.42.fr/oauth/token",
        alias="FORTYTWO_OAUTH_TOKEN_URL",
    )
    fortytwo_api_base_url: str = Field(default="https://api.intra.42.fr/v2", alias="FORTYTWO_API_BASE_URL")

    mobile_deep_link_scheme: str = Field(default="timetracker42", alias="MOBILE_DEEP_LINK_SCHEME")
    sync_cooldown_minutes: int = Field(default=5, alias="SYNC_COOLDOWN_MINUTES")
    stale_warning_hours: int = Field(default=3, alias="STALE_WARNING_HOURS")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
