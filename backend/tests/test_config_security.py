import pytest

from app.core.config import Settings


def test_runtime_security_validation_allows_local_placeholders() -> None:
    settings = Settings(
        APP_ENV="local",
        JWT_SECRET="change_me",
        TOKEN_ENCRYPTION_KEY="dev-change-me",
        FORTYTWO_CLIENT_ID="change_me",
        FORTYTWO_CLIENT_SECRET="change_me",
    )

    settings.validate_runtime_security()


def test_runtime_security_validation_rejects_placeholders_in_non_local() -> None:
    settings = Settings(
        APP_ENV="production",
        JWT_SECRET="change_me",
        TOKEN_ENCRYPTION_KEY="change_me",
        FORTYTWO_CLIENT_ID="change_me",
        FORTYTWO_CLIENT_SECRET="change_me",
    )

    with pytest.raises(RuntimeError) as exc:
        settings.validate_runtime_security()

    message = str(exc.value)
    assert "JWT_SECRET" in message
    assert "TOKEN_ENCRYPTION_KEY" in message
    assert "FORTYTWO_CLIENT_ID" in message
    assert "FORTYTWO_CLIENT_SECRET" in message


def test_runtime_security_validation_accepts_strong_non_local_values() -> None:
    settings = Settings(
        APP_ENV="staging",
        JWT_SECRET="a" * 48,
        TOKEN_ENCRYPTION_KEY="b" * 48,
        FORTYTWO_CLIENT_ID="u-s4t2ud-real-client-id",
        FORTYTWO_CLIENT_SECRET="s-s4t2ud-real-client-secret-123",
    )

    settings.validate_runtime_security()
