# TimeTracker42 Architecture

## Product Goal

TimeTracker42 tracks official 42 campus attendance and answers one question: **is the student ahead or
behind their monthly goal, and what would it take to reach it?** Around that sit goals, deadlines, history
and an attendance planner.

## Components

- **Cloudflare Pages frontend:** React, TypeScript, Vite, Tailwind CSS. A PWA.
- **Supabase Auth:** the browser session.
- **Supabase Edge Functions:** 42 OAuth, auth exchange and manual sync. The only code that holds secrets.
- **Supabase Postgres:** user data protected by row-level security, plus server-only tables.
- **42 API:** OAuth and the location sessions that attendance is derived from.

```text
[Web app on Cloudflare Pages]
  -> Supabase Auth session
  -> RLS-protected table reads and writes (goals, deadlines, plans, history)
  -> Edge Functions for 42-only server work
  -> 42 API
```

## Data Model

| Table | Access | Purpose |
|---|---|---|
| `profiles` | users: read own | 42 identity mapping (`forty_two_user_id`), display name, campus |
| `goals` | users: read/write own | Daily, weekly and monthly goal, pace mode, days per week |
| `deadlines` | users: read/write own | Title, due date, target hours, `start_on`, completion |
| `attendance_plans` | users: read/write own | Per-month schedule: weekdays, extra days, days off, daily cap |
| `attendance_daily` | users: read own | Seconds per Singapore day; `source` is `locations` or `locations_live` |
| `location_sessions` | users: read own | Raw 42 sessions behind the daily totals |
| `sync_runs` | users: read own | Sync history and status (`running`, `success`, `failed`) |
| `forty_two_tokens` | service role only | 42 access and refresh tokens |
| `oauth_states` | service role only | Hashed OAuth state and login binding |
| `auth_exchange_codes` | service role only | Hashed one-time exchange codes and binding |

Writes to sync-derived tables and to `profiles` happen only in Edge Functions. This is enforced by table
grants (not just RLS policies) and covered by pgTAP tests in `supabase/tests/database`.

`finalize_sync()` is a service-role-only function that stores a sync result (sessions, daily totals,
run status) in one transaction.

## Auth Flow

1. The browser creates a random verifier, keeps it in local storage, and sends only its SHA-256
   (`binding`) when the user clicks **Continue with 42**.
2. `forty-two-oauth-start` stores a hashed OAuth state with the binding and redirects to 42.
3. `forty-two-oauth-callback` validates and consumes the state, exchanges the 42 code, fetches `/v2/me`,
   stores the 42 tokens server-side, and creates a one-time exchange code that carries the binding.
4. The frontend callback page sends the exchange code and the verifier to `auth-exchange`.
5. `auth-exchange` redeems the code only if the verifier matches the stored binding (one conditional
   `UPDATE`, so a wrong verifier does not consume the code) and returns a Supabase `token_hash`.
6. The frontend calls `supabase.auth.verifyOtp()` and receives a normal Supabase browser session.

The frontend shares one in-flight sign-in per callback URL, because the exchange code is single-use and
React effects can run more than once. `REQUIRE_LOGIN_BINDING=true` makes the functions reject logins that
arrive without a binding.

## Sync Flow

1. The user clicks **Sync now**; the frontend calls `forty-two-sync-manual` with the Supabase access token.
2. The function verifies the user and takes the per-user lock: abandoned runs (over 10 minutes) are
   closed, a short cooldown after a success is enforced, and a unique index allows one `running` run.
3. It reads the stored 42 token and refreshes it server-side if needed.
4. It fetches location sessions for the bounded window (from a day before the first day of the month five
   months back, through now) plus active sessions. Calls have a timeout and retry 429/5xx with backoff.
5. Totals are computed per Singapore day from merged intervals: overlaps are counted once and a session
   across midnight is split.
6. After a complete fetch, stored days that 42 no longer reports are zeroed; an empty result never wipes
   history.
7. `finalize_sync()` writes sessions, daily totals and the run status atomically.
8. The dashboard and history refetch from Supabase.

## Frontend Model

- All day keys are **Singapore days** (`web/src/lib/singaporeDate.ts`), matching how the sync function
  buckets time, so day, week and month totals agree.
- **Pace** (`lib/pace.ts`): expected hours are linear over the days that count (weekdays or calendar days).
  Status is ahead, on pace, behind, done or no goal, with a tolerance of max(0.5 h, 2% of the goal).
- **Comparisons** (`lib/comparison.ts`): "vs last week/month" compares the same stretch, not a partial
  period against a full one.
- **Planner** (`lib/planner.ts`): from the target, what is attended, the chosen weekdays, extra days, days
  off and a daily cap, it decides feasibility, spreads the remaining hours with water-filling, and
  proposes fixes (raise the cap, or add specific days).
- **Deadlines** (`lib/deadlines.ts`): progress counts attendance from `start_on` to the due date.
- **Demo mode** (`web/src/demo/`) replaces the data accessors with an in-memory store of synthetic data, so
  the real calculations run with no backend. Entering and leaving it is a full page load so the query
  cache never mixes demo and real data.

## Security Principles

- The 42 client secret and the Supabase service role key are Edge Function only.
- 42 access and refresh tokens are never sent to the browser.
- API roles have least-privilege grants: `anon` has none; `authenticated` reads its own rows and writes
  only goals, deadlines and plans.
- The identity mapping used to pick the account at login is not user-writable.
- OAuth state and exchange codes are hashed and single-use; login is bound to the starting browser.
- Sync errors are safe short messages, not raw 42 payloads or stack traces.

## Quality Gates

Web typecheck, unit tests and build; Playwright end-to-end and axe-core accessibility on desktop and phone
viewports; Deno tests and type checks for Edge Functions; database migrations plus pgTAP row-level-security
tests. See the root README for commands.

## Roadmap

- Scheduled, incremental sync.
- Goal versioning, so changing a goal does not reclassify past days.
- Token encryption or Vault-backed token storage.
- Offline history and CSV export; account disconnect and delete.
- Remove the development email OTP fallback after production burn-in.
