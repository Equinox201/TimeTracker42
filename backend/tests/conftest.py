from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import get_db
from app.main import app
from app.models.attendance_daily import AttendanceDaily
from app.models.deadline import Deadline
from app.models.goal import Goal
from app.models.mobile_auth_code import MobileAuthCode
from app.models.oauth_token import OAuthToken
from app.models.refresh_token import AppRefreshToken
from app.models.sync_run import AttendanceSyncRun
from app.models.user import User


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    User.__table__.create(engine)
    Goal.__table__.create(engine)
    Deadline.__table__.create(engine)
    AttendanceDaily.__table__.create(engine)
    OAuthToken.__table__.create(engine)
    MobileAuthCode.__table__.create(engine)
    AppRefreshToken.__table__.create(engine)
    AttendanceSyncRun.__table__.create(engine)

    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = testing_session()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
