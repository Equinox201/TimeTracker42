from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import desc, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import now_utc
from app.models.attendance_daily import AttendanceDaily
from app.models.sync_run import AttendanceSyncRun
from app.models.user import User
from app.services.fortytwo_client import FortyTwoClient, FortyTwoClientError
from app.services.metrics import parse_duration_to_seconds


class SyncError(ValueError):
    pass


@dataclass
class SyncStats:
    sync_run_id: str
    status: str
    inserted_days: int
    updated_days: int
    unchanged_days: int
    started_at: datetime
    finished_at: datetime


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def can_run_manual_sync(db: Session, user_id) -> bool:

    latest_manual_run = db.scalar(
        select(AttendanceSyncRun)
        .where(
            AttendanceSyncRun.user_id == user_id,
            AttendanceSyncRun.trigger == "manual",
        )
        .order_by(desc(AttendanceSyncRun.started_at))
        .limit(1)
    )

    if latest_manual_run is None:
        return True

    latest_started = _as_utc(latest_manual_run.started_at)
    cooldown = timedelta(minutes=settings.sync_cooldown_minutes)
    return now_utc() >= latest_started + cooldown


def _upsert_attendance_rows(
    db: Session,
    user_id,
    payload: dict[str, str | None],
) -> tuple[int, int, int]:
    inserted = 0
    updated = 0
    unchanged = 0

    def _insert_stmt(values: dict):
        bind = db.get_bind()
        if bind is None:
            raise SyncError("Database engine is unavailable")

        table = AttendanceDaily.__table__
        index_elements = [table.c.user_id, table.c.day]

        if bind.dialect.name == "postgresql":
            return pg_insert(table).values(**values).on_conflict_do_nothing(
                index_elements=index_elements
            )
        if bind.dialect.name == "sqlite":
            return sqlite_insert(table).values(**values).on_conflict_do_nothing(
                index_elements=index_elements
            )
        raise SyncError(f"Unsupported database dialect for attendance upsert: {bind.dialect.name}")

    for day_text, duration_raw in payload.items():
        try:
            parsed_day = date.fromisoformat(day_text)
        except ValueError as exc:
            raise SyncError(f"Invalid day key from 42 API: {day_text}") from exc

        try:
            parsed_seconds = parse_duration_to_seconds(duration_raw)
        except ValueError as exc:
            raise SyncError(f"Invalid duration for {day_text}: {duration_raw}") from exc

        source_updated_at = now_utc()
        insert_values = {
            "user_id": user_id,
            "day": parsed_day,
            "duration_seconds": parsed_seconds,
            "source_value_raw": duration_raw,
            "updated_from_source_at": source_updated_at,
        }

        inserted_row = db.execute(_insert_stmt(insert_values))
        if inserted_row.rowcount == 1:
            inserted += 1
            continue

        existing = db.scalar(
            select(AttendanceDaily).where(
                AttendanceDaily.user_id == user_id,
                AttendanceDaily.day == parsed_day,
            )
        )
        if existing is None:
            raise SyncError("Attendance upsert conflict: row disappeared after conflict handling")

        if (
            existing.duration_seconds == parsed_seconds
            and existing.source_value_raw == duration_raw
        ):
            unchanged += 1
            continue

        existing.duration_seconds = parsed_seconds
        existing.source_value_raw = duration_raw
        existing.updated_from_source_at = source_updated_at
        updated += 1

    return inserted, updated, unchanged


def sync_user_attendance(db: Session, user: User, trigger: str) -> SyncStats:
    run = AttendanceSyncRun(
        user_id=user.id,
        trigger=trigger,
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    payload: dict[str, str | None] = {}

    try:
        payload = FortyTwoClient.fetch_locations_stats(db, user)
        inserted, updated, unchanged = _upsert_attendance_rows(db, user.id, payload)

        run.status = "success"
        run.raw_payload_json = payload
        run.finished_at = now_utc()
        run.error_message = None
        db.commit()
        db.refresh(run)

        return SyncStats(
            sync_run_id=str(run.id),
            status=run.status,
            inserted_days=inserted,
            updated_days=updated,
            unchanged_days=unchanged,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )
    except (FortyTwoClientError, SyncError, IntegrityError) as exc:
        db.rollback()

        failed_run = db.get(AttendanceSyncRun, run.id)
        if failed_run is not None:
            failed_run.status = "failed"
            failed_run.raw_payload_json = payload or None
            failed_run.error_message = str(exc)
            failed_run.finished_at = now_utc()
            db.commit()

        raise SyncError(str(exc)) from exc
