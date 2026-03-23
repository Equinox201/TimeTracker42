from datetime import UTC, datetime

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.services.sync_service import SyncError, sync_user_attendance


def run_hourly_sync() -> None:
    started = datetime.now(UTC)
    success_count = 0
    failed_count = 0

    db = SessionLocal()
    try:
        users = db.scalars(
            select(User)
            .join(OAuthToken, OAuthToken.user_id == User.id)
            .where(OAuthToken.provider == "42")
        ).all()

        for user in users:
            try:
                sync_user_attendance(db, user, trigger="hourly")
                success_count += 1
            except SyncError as exc:
                failed_count += 1
                print(f"[hourly_sync] user={user.login} failed: {exc}")

        finished = datetime.now(UTC)
        print(
            "[hourly_sync] "
            f"start={started.isoformat()} "
            f"finish={finished.isoformat()} "
            f"total={len(users)} success={success_count} failed={failed_count}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    run_hourly_sync()
