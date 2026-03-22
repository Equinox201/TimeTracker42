# Local Runbook

## Backend
1. `cd backend`
2. Use Python 3.12 (required by this backend scaffold).
3. `cp .env.example .env`
4. Set database + OAuth values.
5. `python3.12 -m venv .venv && source .venv/bin/activate`
6. `pip install -e '.[dev]'`
7. Run API: `uvicorn app.main:app --reload`
8. Run tests: `pytest`

## iOS
1. Create or open your Xcode project under `ios/`.
2. Add folders from `ios/CampusTracker/` into the app target.
3. Set `API_BASE_URL` in an xcconfig or build setting.
4. Build and run on iPhone simulator/device.

## Scheduled Sync (local)
From `backend/`:
- `python -m app.jobs.hourly_sync`
