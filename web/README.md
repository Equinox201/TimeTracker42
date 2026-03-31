# TimeTracker42 Web

Mobile-first web frontend for TimeTracker42, reusing the existing FastAPI backend.

## Local Run

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Default URL: `http://127.0.0.1:5173`

## Build

```bash
npm run typecheck
npm run build
npm run preview
```

## Required Backend Env (for web auth + CORS)

Set these in `backend/.env` and restart backend:

```env
WEB_OAUTH_REDIRECT_URIS=http://127.0.0.1:5173/auth/callback,http://localhost:5173/auth/callback
WEB_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

## Milestones Implemented

1. App shell, routing, theme, PWA base
2. Auth session integration (OTC exchange)
3. Main page wired (rings, KPIs, stale banner, month calendar, manual sync)
4. History page wired (6-month bars, range summary, month picker, month summary)
5. Settings page wired (goals save flow, pace controls, deadlines CRUD)
6. Release polish (route code splitting, offline banner, chunk splitting)
7. Hardening pass (global UI error boundary + API timeout/network handling)

## Pre-release Smoke Checklist

1. Login flow: `/login` -> 42 OAuth -> `/auth/callback` -> `/app/main`
2. Main page: refresh + sync button update dashboard values
3. History page: month chip changes calendar and month summary
4. Settings: save goals updates Main/History after refresh
5. Deadlines: add, complete toggle, delete
6. Offline: disable network in browser devtools, verify offline banner appears
7. Build gate: `npm run typecheck && npm run build`
