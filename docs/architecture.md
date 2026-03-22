# TimeTracker42 Architecture (Phase 1)

## Product Goal
A secure iPhone app + backend that tracks official 42 attendance data and helps users hit monthly attendance goals.

## High-Level Components
- iOS app (SwiftUI, SwiftData cache)
- FastAPI backend
- PostgreSQL database
- Hourly sync worker
- 42 OAuth + 42 API integration

## Data Flow
1. App starts OAuth through backend.
2. Backend exchanges code with 42 securely.
3. Backend stores encrypted 42 tokens.
4. Hourly sync fetches `/v2/users/:id/locations_stats`.
5. Raw payload archived, normalized daily values upserted.
6. App queries backend dashboard/history endpoints.
7. App caches responses locally and shows stale warnings when needed.

## Security Principles
- 42 client secret is backend-only.
- Short-lived app access tokens + rotating refresh tokens.
- Refresh tokens stored hashed.
- TLS required.

## Scalability
Schema and service boundaries are multi-user ready from day 1.
