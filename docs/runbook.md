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

## Diagnosing sign-in failures

Every Edge Function writes one JSON line per event (`fn`, `event`, `request_id`,
`level`, plus event-specific fields). Secrets, authorization codes and tokens are
never logged. In the Supabase dashboard, open **Logs → Edge Functions** and search
for the `event` name, or query the unified logs:

```sql
select timestamp, event_message
from logs
where source = 'function_logs' and event_message like '%"level":"error"%'
order by timestamp desc
limit 50
```

The browser only ever sees a short `error=` code on `/auth/callback`; the event
below carries the actual reason.

| Browser `error=` | Log `event` | Typical cause |
|---|---|---|
| `forty_two_exchange_failed` | `token_exchange_rejected` | `FORTY_TWO_CLIENT_SECRET` rotated or wrong (`invalid_client`), or `FORTY_TWO_REDIRECT_URI` does not match the 42 app |
| `forty_two_profile_failed` | `profile_fetch_rejected` | 42 API outage or revoked token |
| `auth_setup_failed` | `auth_setup_failed` | Supabase user/profile/token writes failed; check `reason` |
| `invalid_state` | `invalid_state` | OAuth state expired (10 min) or already used |
| `forty_two_denied` | `forty_two_denied` | User declined on 42 |
| – (HTTP 400 on `auth-exchange`) | `exchange_code_rejected` | Single-use exchange code replayed |
| – (sync says "42 session expired") | `token_refresh_rejected` | Refresh token or client secret rejected by 42 |

### Rotating the 42 client secret

1. Generate a new secret in the 42 intra app settings.
2. Update `FORTY_TWO_CLIENT_SECRET` in Supabase (Edge Functions → Secrets, or
   `npx supabase secrets set FORTY_TWO_CLIENT_SECRET=...`). No redeploy is needed.
3. Sign in again and confirm `login_succeeded` appears in the logs.

## Incident notes: sign-in failing after deployment (October 2026)

**Symptom.** Signing in with 42 ended on `/auth/callback?error=forty_two_exchange_failed`, and after
the fix below, on "Could not complete 42 sign-in. Please try again."

**Cause 1: 42 rejected the token exchange.** The Edge Function swallowed the failure, so the logs only
showed a 302. The error code pointed at the exchange step, and rotating `FORTY_TWO_CLIENT_SECRET` fixed
it, consistent with a stale client secret. The response body from 42 was not logged at the time, which is
why structured logging (`token_exchange_rejected`) was added.

**Cause 2: the single-use exchange code was posted three times.** `AuthCallbackPage` re-ran its effect
whenever the auth context changed (`booting` to `ready`, then session set), and each run POSTed the same
`exchange_code` to `auth-exchange`. One call succeeded (200) and the replays were rejected (400), so the
page showed an error although the session had been created. The sign-in attempt is now shared per callback
URL (`web/src/lib/shareAttempt.ts`, covered by unit tests).

**How it was found.** Function request logs showed one `forty-two-oauth-callback` followed by three
`auth-exchange` POSTs about a second apart, which pointed at the client rather than at 42.
