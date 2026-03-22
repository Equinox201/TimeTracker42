from datetime import UTC, datetime


def run_hourly_sync() -> None:
    now = datetime.now(UTC).isoformat()
    print(f"[{now}] TODO: run scheduled sync for active users")


if __name__ == "__main__":
    run_hourly_sync()
