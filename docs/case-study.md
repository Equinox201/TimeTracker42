# TimeTracker42: case study

## The problem

42 students have to meet a monthly campus attendance target. The official numbers are available but
awkward to read, and the useful question is never "how many hours do I have?" but **"am I ahead or
behind, and what does it take to finish the month on target?"**

TimeTracker42 syncs a student's official 42 location sessions and answers that question every day.

## What it is

- A React + TypeScript web app (PWA) on Cloudflare Pages.
- Supabase for auth, Postgres with row-level security, and Edge Functions for everything that touches
  42 or a secret.
- A pace-first dashboard, an attendance planner, goals and deadlines, history, and a demo mode that
  runs on synthetic data with no backend.

Live demo: https://timetracker42.pages.dev/demo. Architecture: [architecture.md](architecture.md).

## Decisions and trade-offs

**Custom 42 OAuth in Edge Functions.** The browser never sees 42 tokens or the client secret; the server
exchanges the code, maps the stable 42 user id to a Supabase user, and hands the browser a one-time
code. The cost is more security-sensitive code to own, which is why that code has dedicated tests.

**Row-level security without an API server.** The app reads and writes its own rows straight from
Supabase. A hardening pass found that RLS alone was not enough: users could update their own profile
row, including the 42 id that the login flow trusts to choose an account. The fix was at the grant
level (users cannot write `profiles` at all), with pgTAP tests that try to do exactly that.

**Browser-bound login.** A callback URL replayed in another browser could sign a victim into the
attacker's account (login CSRF). The browser now keeps a random verifier and sends only its hash; the
exchange code can only be redeemed with the matching verifier, checked inside the same atomic `UPDATE`
that consumes the code, so a wrong guess does not burn it. Trade-off: it relies on browser storage, so
a login that finishes in a different browser context (an in-app browser, an iOS home-screen app) cannot
complete. It is gated by a flag and documented in the runbook.

**Making sync trustworthy.** Early sync summed sessions independently, so two overlapping sessions
counted twice, days that disappeared upstream never went away, and two clicks ran two syncs. Presence is
now computed from merged intervals, split at Singapore midnight; reconciliation zeroes vanished days
(but never on an empty result); one run per user is enforced by a unique index; upstream calls have
timeouts and bounded retries; and results are written by a single database function so sessions, totals
and run status land together or not at all.

**Pace and planning as pure functions.** "Ahead or behind" and "is the goal reachable?" are small,
deterministic functions of the goal, attendance and a calendar, so they are unit-tested exhaustively and
the demo runs the same code on synthetic data. Planning is deliberately separate from goals: a
suggestion never rewrites the target.

## What went wrong, and what it taught me

- **A stale secret hid a second bug.** Sign-in failed after the 42 client secret was rotated. Rotating
  the secret fixed the exchange, and sign-in still failed: the frontend was posting the single-use code
  three times because an effect re-ran when the auth context changed. The server logs showed one
  callback followed by three exchange requests a second apart, which is what pointed at the client.
  Lesson: swallowed errors cost time, so every Edge Function now logs one structured event per outcome,
  and the runbook maps each browser-visible error to its log event.
- **Styles that silently did nothing.** Tinted backgrounds and borders across the old design were never
  generated, because Tailwind cannot apply opacity to a colour defined as a plain CSS variable. It was
  found while building the redesign, fixed by moving tokens to RGB channels, and a contrast test now
  covers text on tinted backgrounds as well as flat surfaces.
- **Verifying a review before acting on it.** An independent review listed several problems. I checked
  each against the code and, for the database claims, against the production project before changing
  anything. Most were real; the severity was not always what the review said, and one claim about
  dependencies turned out to be dev-only.
- **Stacked pull requests.** I stacked three PRs on top of each other and merged them in order; only the
  first reached `main`, because each one's base was the previous branch. It was caught by checking that
  the files existed on `main` rather than trusting "merged", and fixed with a single landing PR. Lesson:
  retarget before merging, or do not stack.
- **My own tests were wrong more than once.** Twice the code was right and the test expectation was
  wrong (for example a session placed after the test's fixed "now"). Reading the failure carefully
  before "fixing" the code mattered.

## How it is verified

At the time of writing: about 180 unit tests (pace, planner, deadlines, dates, demo data, colour
contrast), around 30 Deno tests for the shared Edge Function modules, around 40 pgTAP assertions for
grants and row-level security, and Playwright end-to-end and axe-core accessibility checks on a desktop
and a phone viewport in light and dark. CI runs all four on every pull request, and the browser tests
run against the production build with no backend configured.

## How I used AI tools

This project was built with AI assistance: an AI coding assistant for implementation, tests and debugging, 
and a second model as an independent reviewer. Whatstayed with me: what to build, which review findings to 
act on, and verifying behaviour in the real system rather than trusting generated code. Examples of where 
the tools were wrong and how it was caught are in the section above.

## What I would do next

- Scheduled, incremental sync instead of manual only.
- Goal versioning, so changing a goal does not reclassify past days.
- Encrypt the stored 42 tokens at rest (Supabase Vault).
- Account disconnect and data deletion, with a privacy note.
- Put it in front of a handful of real students and act on what they say.
