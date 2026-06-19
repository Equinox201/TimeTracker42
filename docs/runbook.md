# Runbook

## Web App

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Build:

```bash
cd web
npm run typecheck
npm run build
```

## Frontend Environment

Set locally and in Cloudflare Pages:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_FUNCTIONS_URL
VITE_ENABLE_EMAIL_OTP_FALLBACK
```

Production should keep `VITE_ENABLE_EMAIL_OTP_FALLBACK=false` or unset.

## Supabase Secrets

Set these in Supabase Edge Function secrets:

```text
EDGE_SUPABASE_URL
EDGE_SUPABASE_SERVICE_ROLE_KEY
FORTY_TWO_CLIENT_ID
FORTY_TWO_CLIENT_SECRET
FORTY_TWO_REDIRECT_URI
FORTY_TWO_AUTH_EMAIL_DOMAIN
APP_ORIGIN
```

Do not commit secret values.

## Database

Apply Supabase migrations:

```bash
npx supabase db push
```

## Edge Function Deploys

```bash
npx supabase functions deploy forty-two-oauth-start
npx supabase functions deploy forty-two-oauth-callback
npx supabase functions deploy auth-exchange
npx supabase functions deploy forty-two-sync-manual
```

## Cloudflare Pages

Recommended settings:

```text
Root directory: web
Build command: npm run build
Build output directory: dist
```

## Manual Verification

1. Sign in with 42.
2. Confirm `/auth/callback` establishes a Supabase session.
3. Click Sync Now on Main.
4. Confirm `sync_runs`, `location_sessions`, and `attendance_daily` update.
5. Confirm Main and History show last-sync metadata.
6. Confirm Settings can read/write goals and deadlines.
