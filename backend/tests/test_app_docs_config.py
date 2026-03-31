from app.main import create_app


def test_docs_enabled_in_local(monkeypatch) -> None:
    monkeypatch.setattr("app.main.settings.app_env", "local")
    app = create_app()
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"


def test_docs_disabled_in_production(monkeypatch) -> None:
    monkeypatch.setattr("app.main.settings.app_env", "production")
    monkeypatch.setattr("app.main.settings.jwt_secret", "a" * 48)
    monkeypatch.setattr("app.main.settings.token_encryption_key", "b" * 48)
    monkeypatch.setattr("app.main.settings.fortytwo_client_id", "u-s4t2ud-real-client-id")
    monkeypatch.setattr(
        "app.main.settings.fortytwo_client_secret",
        "s-s4t2ud-real-client-secret-123",
    )

    app = create_app()
    assert app.docs_url is None
    assert app.redoc_url is None
