# TimeTracker42

TimeTracker42 is a mobile-first attendance tracker for 42 students. It signs users in with 42 OAuth, syncs official campus location sessions, and turns that attendance history into dashboard progress, monthly history, goals, deadlines, stale-data warnings, and manual sync feedback.

Try the web app: https://timetracker42.pages.dev/

## Preview

![TimeTracker42 feature preview](assets/Feature_visual.png)

## What It Does

- Secure 42 OAuth login through Supabase Edge Functions.
- Manual attendance sync from the 42 API.
- Daily, weekly, and monthly attendance progress.
- Six-month attendance history and monthly calendar views.
- User-owned goals and deadlines stored in Supabase Postgres.
- Stale/failed/last-sync status from `sync_runs`.
- Mobile-first web UI suitable for iPhone Safari and PWA-style use.

## Current Architecture

```text
[Cloudflare Pages: React/Vite Web App]
          |
          | Supabase Auth session + RLS-protected table reads/writes
          v
[Supabase Auth] ---- [Supabase Postgres + RLS]
          ^
          |
[Supabase Edge Functions]
  - forty-two-oauth-start
  - forty-two-oauth-callback
  - auth-exchange
  - forty-two-sync-manual
          |
          v
       [42 API]
```

### Frontend

- Hosted on Cloudflare Pages.
- Built with React, TypeScript, Vite, Tailwind CSS, React Query, and Recharts.
- Reads dashboard, history, settings, goals, and deadlines directly from Supabase under RLS.
- Calls Edge Functions for 42 OAuth and manual sync.

### Auth

- Supabase Auth owns the browser session.
- 42 OAuth is implemented with custom Supabase Edge Functions:
  - `forty-two-oauth-start` creates a hashed OAuth state and redirects to 42.
  - `forty-two-oauth-callback` validates state, exchanges the 42 code server-side, stores 42 tokens, and creates a one-time exchange code.
  - `auth-exchange` redeems the exchange code and returns a Supabase `token_hash` for the browser to verify with Supabase Auth.
- Temporary email OTP fallback exists for development and is hidden by default.

### Data

- Supabase Postgres stores user-owned data:
  - `profiles`
  - `goals`
  - `deadlines`
  - `attendance_daily`
  - `location_sessions`
  - `sync_runs`
- RLS protects user-owned tables.
- `forty_two_tokens`, `oauth_states`, and `auth_exchange_codes` are internal service-role tables and are not directly readable by frontend clients.

### Manual Sync

- `forty-two-sync-manual` requires a Supabase JWT.
- It reads the authenticated user's stored 42 token server-side.
- It refreshes the 42 token when needed.
- It fetches 42 location sessions from:

```text
GET https://api.intra.42.fr/v2/users/:id/locations
```

- Manual sync currently fetches a bounded recent-history window: from the first day of the month five months before the current month through now, plus active sessions.
- It writes normalized sessions to `location_sessions`, recomputes touched daily totals in `attendance_daily`, and records status in `sync_runs`.

## Repository Structure

```text
web/       React + TypeScript frontend for Cloudflare Pages
supabase/  Database migrations and Edge Functions
docs/      Architecture, runbook, and function contract notes
ios/       Legacy iOS project kept for reference while the web app is prioritized
```

## Frontend Environment Variables

Set these in Cloudflare Pages and local `.env` files:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_FUNCTIONS_URL=
VITE_ENABLE_EMAIL_OTP_FALLBACK=false
```

`VITE_ENABLE_EMAIL_OTP_FALLBACK` must be exactly `true` to show the development email OTP fallback. Production should leave it `false` or unset.

## Supabase Edge Function Secrets

Set these with Supabase secrets. Do not put these in frontend env vars.

```text
EDGE_SUPABASE_URL
EDGE_SUPABASE_SERVICE_ROLE_KEY
FORTY_TWO_CLIENT_ID
FORTY_TWO_CLIENT_SECRET
FORTY_TWO_REDIRECT_URI
FORTY_TWO_AUTH_EMAIL_DOMAIN
APP_ORIGIN
```

## Local Web Development

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173
```

## Deployment

### Frontend: Cloudflare Pages

Deploy the `web/` app through Cloudflare Pages.

Recommended settings:

```text
Root directory: web
Build command: npm run build
Build output directory: dist
```

Configure the frontend environment variables listed above in Cloudflare Pages.

### Supabase Database

Apply migrations with:

```bash
npx supabase db push
```

### Supabase Edge Functions

Deploy functions with:

```bash
npx supabase functions deploy forty-two-oauth-start
npx supabase functions deploy forty-two-oauth-callback
npx supabase functions deploy auth-exchange
npx supabase functions deploy forty-two-sync-manual
```

Set or update secrets with:

```bash
npx supabase secrets set EDGE_SUPABASE_URL=... EDGE_SUPABASE_SERVICE_ROLE_KEY=...
npx supabase secrets set FORTY_TWO_CLIENT_ID=... FORTY_TWO_CLIENT_SECRET=...
npx supabase secrets set FORTY_TWO_REDIRECT_URI=... FORTY_TWO_AUTH_EMAIL_DOMAIN=... APP_ORIGIN=...
```

Do not commit actual secret values.

## Quality Gates

Web checks:

```bash
cd web
npm run typecheck
npm run build
```

Edge Functions are Deno/Supabase functions. Run Deno checks locally if `deno` is installed, or validate through deployment/runtime testing.

## Security

- 42 access and refresh tokens stay server-side in Supabase.
- The Supabase service role key is used only inside Edge Functions.
- Frontend clients use Supabase Auth sessions and RLS-protected access.
- User-owned tables are protected by RLS policies.
- OAuth state values are stored only as SHA-256 hashes.
- Auth exchange codes are stored only as SHA-256 hashes and are single-use.
- 42 client secret is never exposed to the frontend.
- Sync errors store safe short messages only, not raw payloads, tokens, or stack traces.

## Roadmap

- Scheduled sync through Supabase Edge Functions.
- Token encryption or Vault-backed token storage.
- Richer live-session display on dashboard/history.
- Remove the email OTP fallback once production 42 login has enough burn-in.
- Optional reconciliation/backfill using additional 42 API sources if needed.
