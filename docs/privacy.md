# Privacy

TimeTracker42 is a personal project for 42 students. This page says what it stores, why, who else
touches it, and how to remove it.

## What is stored

| Data | Why |
|---|---|
| Your 42 numeric id, login, display name and campus id | To recognise you when you sign in and show your name |
| Your 42 access and refresh tokens (server-side only, never sent to your browser) | To fetch your attendance from the 42 API when you sync |
| Your campus sessions (start, end, host, campus) and daily totals | The attendance the app is built to show |
| Your goals, deadlines (titles and notes you type) and monthly plans | The settings and plans you create |
| Sync history (when it ran, whether it succeeded, a short error message) | To show freshness and diagnose failures |
| A generated, non-routable account identifier of the form `ft-<id>@<internal domain>` | Supabase Auth needs one; it is not your real email and no email is sent to it |

## What is not stored
- Your password (42 handles authentication; the app only receives an authorization code).
- Your real email address. The 42 profile includes one; this app does not save it.
- Anything beyond the `public` 42 scope.

## In your browser
Your sign-in session, your theme preference, a short-lived value used to bind a login to your browser,
and a flag that remembers you are in demo mode. There are no advertising or analytics scripts in the
app's code.

## Who else handles it
- **Supabase**: database, authentication and server functions.
- **Cloudflare**: serves the web app.
- **42**: the sign-in and the source of the attendance data.

## Logs
Server logs record events (for example "login succeeded", "sync completed") with your internal user id or
your 42 numeric id, never tokens, codes or secrets. They are kept for the log provider's retention period
and are not removed by deleting your account.

## Deleting your data
Open **Settings, then Delete my data** and confirm. This permanently removes your account and everything in
the table above. It does not change anything on 42, and you can sign in again later to start fresh.
You can also revoke TimeTracker42's authorization from your 42 account settings.

## Demo mode
The demo uses synthetic data for a fictional student. Nothing you do in it is sent to or stored on a
server.

## Questions
Open an issue on the repository.
