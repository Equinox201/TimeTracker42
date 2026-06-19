# Edge Function Contract

Browser sessions are managed by Supabase Auth, user-owned data is read/written through Supabase with RLS, and 42-specific server work happens in Supabase Edge Functions.

## Public Edge Functions

### `GET /forty-two-oauth-start`

Starts the 42 OAuth flow.

Query params:

- `redirect_to` optional frontend callback URL. Must match the configured app origin.

Behavior:

- Creates a random OAuth state.
- Stores only its SHA-256 hash in `oauth_states`.
- Redirects to 42 OAuth.

### `GET /forty-two-oauth-callback`

Receives the 42 OAuth callback.

Query params from 42:

- `code`
- `state`
- `error` optional

Behavior:

- Validates and consumes OAuth state once.
- Exchanges the 42 code server-side.
- Fetches `/v2/me`.
- Creates or reuses a Supabase Auth user.
- Upserts `profiles` and `forty_two_tokens`.
- Creates a one-time exchange code.
- Redirects to `/auth/callback?exchange_code=...`.

### `POST /auth-exchange`

Redeems a one-time exchange code for a Supabase Auth token hash.

Request:

```json
{
  "exchange_code": "..."
}
```

Response:

```json
{
  "token_hash": "...",
  "type": "email"
}
```

### `POST /forty-two-sync-manual`

Runs manual 42 attendance sync for the authenticated Supabase user.

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

Behavior:

- Verifies the Supabase user.
- Reads stored 42 tokens server-side.
- Refreshes the 42 token when needed.
- Fetches bounded recent history from `/v2/users/:id/locations`.
- Upserts `location_sessions`.
- Recomputes touched `attendance_daily` rows.
- Writes `sync_runs`.
