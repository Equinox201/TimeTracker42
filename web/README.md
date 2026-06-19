# TimeTracker42 Web

Mobile-first React frontend for TimeTracker42. The production frontend is deployed on Cloudflare Pages and uses Supabase Auth, Supabase Postgres/RLS, and Supabase Edge Functions for 42 OAuth and manual sync.

## Local Run

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Default URL:

```text
http://127.0.0.1:5173
```

## Build

```bash
npm run typecheck
npm run build
npm run preview
```

## Frontend Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_FUNCTIONS_URL=
VITE_ENABLE_EMAIL_OTP_FALLBACK=false
```

`VITE_ENABLE_EMAIL_OTP_FALLBACK=true` shows the development-only email OTP fallback. Production should keep it false or unset.

## Runtime Dependencies

- Supabase Auth for browser sessions.
- Supabase RLS-protected tables for dashboard, history, goals, and deadlines.
- `forty-two-oauth-start`, `forty-two-oauth-callback`, and `auth-exchange` for 42 login.
- `forty-two-sync-manual` for Sync Now.

## Cloudflare Pages

Recommended settings:

```text
Root directory: web
Build command: npm run build
Build output directory: dist
```

Set the frontend environment variables in Cloudflare Pages.

## Smoke Checklist

1. Login flow: `/login` -> `Continue with 42` -> 42 OAuth -> `/auth/callback` -> `/app/main`.
2. Main page: Sync Now completes and updates last-sync status.
3. History page: six-month attendance history loads after sync.
4. Settings: goals and deadlines read/write through Supabase.
5. Email OTP fallback remains hidden unless `VITE_ENABLE_EMAIL_OTP_FALLBACK=true`.
6. Build gate: `npm run typecheck && npm run build`.
