# Edge Function Contract

Browser sessions are managed by Supabase Auth, user-owned data is read and written through Supabase with
RLS, and 42-specific server work happens in Supabase Edge Functions. Errors that reach a person are short
and safe; the reason is in the structured logs (see the [runbook](runbook.md)).

| Function | Method | `verify_jwt` | Called by |
|---|---|---|---|
| `forty-two-oauth-start` | `GET` | no | Browser navigation |
| `forty-two-oauth-callback` | `GET` | no | 42 redirect |
| `auth-exchange` | `POST` | no | Frontend callback page |
| `forty-two-sync-manual` | `POST` | yes | Frontend, signed in |
| `delete-account` | `POST` | yes | Frontend, Settings |

## `GET /forty-two-oauth-start`

Starts the 42 OAuth flow.

Query params:

- `redirect_to` optional frontend callback URL. Must match the configured app origin.
- `binding` the base64url SHA-256 of a verifier the browser keeps (43 characters). Required when
  `REQUIRE_LOGIN_BINDING=true`.

Behavior:

- Creates a random OAuth state and stores only its SHA-256 hash, with `redirect_to` and the binding, in
  `oauth_states`.
- Redirects (`302`) to 42 OAuth.

Errors (JSON): `400` `Invalid redirect_to.`, `400` `Invalid binding.`, `400` `Login binding is required.`,
`405`, `500`.

## `GET /forty-two-oauth-callback`

Receives the 42 OAuth callback.

Query params from 42: `code`, `state`, `error` (optional).

Behavior:

- Validates and consumes the OAuth state once.
- Exchanges the 42 code server-side and fetches `/v2/me`.
- Creates or reuses the Supabase Auth user mapped to the stable 42 user id.
- Upserts `profiles` and `forty_two_tokens`.
- Creates a one-time exchange code carrying the state's binding.
- Redirects (`302`) to `/auth/callback?exchange_code=...`, or to `/auth/callback?error=<code>`.

Error codes sent to the browser:

| `error=` | Meaning |
|---|---|
| `invalid_state` | State missing, expired (10 min) or already used |
| `forty_two_denied` | The user declined on 42 |
| `missing_code` | 42 returned no authorization code |
| `forty_two_exchange_failed` | 42 rejected the token exchange (for example a rotated client secret) |
| `forty_two_profile_failed` | The token worked but `/v2/me` failed |
| `auth_setup_failed` | Creating or updating the Supabase user, profile or tokens failed |

A misconfigured function returns `500` JSON `Server configuration is incomplete.`

## `POST /auth-exchange`

Redeems a one-time exchange code for a Supabase Auth token hash, for the browser that started the login.

Request:

```json
{
  "exchange_code": "...",
  "verifier": "..."
}
```

`verifier` is the value whose SHA-256 was sent as `binding`. It is required for any login that started
with a binding (and for all logins when `REQUIRE_LOGIN_BINDING=true`).

Response:

```json
{
  "token_hash": "...",
  "type": "email"
}
```

Errors (JSON): `400` `Invalid exchange code.` (malformed body), `400` `Invalid or expired exchange code.`
(expired, already used, or the verifier does not match; deliberately not distinguished), `403`
`Origin not allowed.`, `405`, `500` `Could not prepare sign-in.`

The code is consumed only when every condition matches, so a request with a wrong verifier does not burn
it. The server never returns 42 tokens.

## `POST /forty-two-sync-manual`

Runs a manual 42 attendance sync for the authenticated Supabase user.

Headers:

```text
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

Request:

```json
{}
```

Response:

```json
{
  "syncRunId": "...",
  "status": "success",
  "insertedDays": 0,
  "updatedDays": 0,
  "unchangedDays": 0,
  "startedAt": "...",
  "finishedAt": "..."
}
```

`updatedDays` includes days that were reconciled down to zero.

Behavior:

- Verifies the Supabase user and takes the per-user sync lock.
- Reads stored 42 tokens server-side and refreshes the 42 token when needed.
- Fetches bounded recent history from `/v2/users/:id/locations` plus active sessions, with a timeout and
  retries on 429/502/503/504.
- Computes daily presence from merged intervals, split at Singapore midnight.
- Writes sessions, daily totals and the run status in one transaction (`finalize_sync()`).

Errors (JSON `{ "error": "..." }`):

| Status | Message | When |
|---|---|---|
| `401` | `Not authenticated.` | Missing or invalid Supabase token |
| `401` | `42 session expired. Please sign in again.` | 42 rejected the token or its refresh |
| `400` | `42 account is not connected.` | No stored 42 identity or token |
| `409` | `A sync is already running. Please wait for it to finish.` | Another run holds the lock |
| `429` | `Synced a moment ago. Please wait a few seconds and try again.` | Cooldown after a success |
| `429` | `42 rate limit reached. Please try again later.` | 42 rate limit after retries |
| `502` | `Could not fetch 42 locations.` | Upstream error |
| `504` | `42 did not respond in time. Please try again.` | Upstream timeout after retries |
| `500` | `Could not save attendance.` and similar | Database failure; the run is recorded as failed |

## `POST /delete-account`

Permanently deletes the signed-in user and everything stored for them. Every user-owned table
references `auth.users` with `ON DELETE CASCADE`, so removing the auth user removes the profile, 42
tokens, attendance, sessions, goals, deadlines, plans, sync runs and pending exchange codes in one step.
Nothing is changed on 42.

Headers:

```text
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

Request (the exact word is required):

```json
{
  "confirm": "DELETE"
}
```

Response:

```json
{
  "deleted": true
}
```

Errors (JSON `{ "error": "..." }`): `400` `Type DELETE to confirm.`, `401` `Not authenticated.`, `403`
`Origin not allowed.`, `405`, `500` `Could not delete your data. Please try again.`
