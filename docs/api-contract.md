# API Contract (Draft)

Base path: `/api/v1`

## Health
- `GET /health`

## Auth
- `GET /auth/42/start`
- `GET /auth/42/callback`
- `POST /auth/mobile/exchange`
- `POST /auth/refresh`
- `POST /auth/logout`

## Dashboard
- `GET /dashboard/summary`

## Attendance
- `GET /attendance/history?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Goals
- `GET /goals/current`
- `PUT /goals/current`

## Deadlines
- `GET /deadlines`
- `POST /deadlines`
- `PUT /deadlines/{deadline_id}`
- `DELETE /deadlines/{deadline_id}`

## Sync
- `POST /sync/manual`

## Common response envelope
```json
{
  "data": {},
  "meta": {
    "request_id": "uuid"
  }
}
```
