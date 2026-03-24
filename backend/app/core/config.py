from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="local", alias="APP_ENV")
    app_base_url: str = Field(default="http://127.0.0.1:8000", alias="APP_BASE_URL")
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
    oauth_state_ttl_minutes: int = Field(default=10, alias="OAUTH_STATE_TTL_MINUTES")
    mobile_otc_ttl_minutes: int = Field(default=5, alias="MOBILE_OTC_TTL_MINUTES")

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
    fortytwo_api_base_url: str = Field(
        default="https://api.intra.42.fr/v2",
        alias="FORTYTWO_API_BASE_URL",
    )

    mobile_deep_link_scheme: str = Field(default="timetracker42", alias="MOBILE_DEEP_LINK_SCHEME")
    sync_cooldown_minutes: int = Field(default=5, alias="SYNC_COOLDOWN_MINUTES")
    stale_warning_hours: int = Field(default=3, alias="STALE_WARNING_HOURS")
    rate_limit_auth_start_per_minute: int = Field(default=20, alias="RATE_LIMIT_AUTH_START_PER_MINUTE")
    rate_limit_auth_exchange_per_minute: int = Field(
        default=10,
        alias="RATE_LIMIT_AUTH_EXCHANGE_PER_MINUTE",
    )
    rate_limit_auth_refresh_per_minute: int = Field(
        default=30,
        alias="RATE_LIMIT_AUTH_REFRESH_PER_MINUTE",
    )
    rate_limit_sync_manual_per_minute: int = Field(
        default=6,
        alias="RATE_LIMIT_SYNC_MANUAL_PER_MINUTE",
    )

    def validate_runtime_security(self) -> None:
        env = self.app_env.strip().lower()
        if env in {"local", "test", "testing"}:
            return

        placeholder_values = {"", "change_me", "dev-change-me"}
        errors: list[str] = []

        def require_secret(name: str, value: str, min_length: int) -> None:
            normalized = value.strip()
            if normalized in placeholder_values:
                errors.append(f"{name} must not use a placeholder value in APP_ENV={self.app_env}")
                return
            if len(normalized) < min_length:
                errors.append(
                    f"{name} is too short for APP_ENV={self.app_env} "
                    f"(minimum {min_length} characters)"
                )

        require_secret("JWT_SECRET", self.jwt_secret, min_length=32)
        require_secret("TOKEN_ENCRYPTION_KEY", self.token_encryption_key, min_length=32)
        require_secret("FORTYTWO_CLIENT_SECRET", self.fortytwo_client_secret, min_length=24)

        client_id = self.fortytwo_client_id.strip()
        if client_id in placeholder_values:
            errors.append(f"FORTYTWO_CLIENT_ID must not use a placeholder value in APP_ENV={self.app_env}")

        if errors:
            joined = "; ".join(errors)
            raise RuntimeError(f"Invalid runtime security configuration: {joined}")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
