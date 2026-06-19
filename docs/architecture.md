# TimeTracker42 Architecture

## Product Goal

TimeTracker42 tracks official 42 campus attendance and helps users understand daily, weekly, and monthly progress against their goals.

## Current Components

- Cloudflare Pages frontend: React, TypeScript, Vite, Tailwind CSS.
- Supabase Auth: browser sessions.
- Supabase Edge Functions: 42 OAuth, auth exchange, and manual sync.
- Supabase Postgres: user data protected by RLS.
- 42 API: OAuth and location session source of truth.

## High-Level Flow

```text
[Web App on Cloudflare Pages]
  -> Supabase Auth session
  -> RLS-protected Supabase table reads/writes
  -> Supabase Edge Functions for 42-only server work
  -> 42 API
```

## Auth Flow

1. User clicks Continue with 42.
2. `forty-two-oauth-start` stores a hashed OAuth state and redirects to 42.
3. `forty-two-oauth-callback` validates and consumes state, exchanges the 42 code, fetches `/v2/me`, stores server-side 42 tokens, and creates a one-time exchange code.
4. The frontend callback redeems the exchange code through `auth-exchange`.
5. `auth-exchange` returns a Supabase `token_hash`.
6. The frontend calls `supabase.auth.verifyOtp()` and receives a normal Supabase browser session.

## Sync Flow

1. User clicks Sync Now.
2. Frontend calls `forty-two-sync-manual` with the current Supabase access token.
3. The function verifies the Supabase user.
4. The function reads that user's stored 42 token.
5. If needed, the function refreshes the 42 token server-side.
6. The function fetches bounded recent history from `/v2/users/:id/locations`, plus active sessions.
7. The function upserts `location_sessions`, recomputes touched `attendance_daily` rows, and writes `sync_runs`.
8. Dashboard and history refetch from Supabase.

## Security Principles

- 42 client secret is Edge Function only.
- 42 access and refresh tokens are never sent to the browser.
- Supabase service role key is Edge Function only.
- RLS protects user-owned tables.
- OAuth state and auth exchange codes are hashed and single-use.
- Sync errors are safe short messages, not raw 42 payloads or stack traces.

## Roadmap

- Scheduled sync.
- Token encryption or Vault-backed token storage.
- Richer live-session display.
- Remove the development email OTP fallback after production burn-in.
