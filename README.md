# TimeTracker42

iPhone attendance tracker for 42 students.

This repository is organized as a monorepo with:
- `backend/` FastAPI + PostgreSQL service (OAuth, sync, KPIs)
- `ios/` SwiftUI app source folders
- `docs/` architecture, API contract, and runbook

## Current Status
Phase 1 (system design + scaffold) is in place.

## Repository Structure
```text
backend/
ios/
docs/
.github/workflows/
```

## Quick Start (Backend)
1. `cd backend`
2. `cp .env.example .env`
3. Fill in required env vars
4. `python -m venv .venv && source .venv/bin/activate`
5. `pip install -e .[dev]`
6. `uvicorn app.main:app --reload`

Health endpoint:
- `GET http://127.0.0.1:8000/api/v1/health`
