# TimeTracker42 Web

The React frontend for TimeTracker42, deployed on Cloudflare Pages. It uses Supabase Auth, Supabase
Postgres under row-level security, and Supabase Edge Functions for 42 sign-in and manual sync.

The project overview, architecture and screenshots are in the [root README](../README.md).

## Run

```bash
cd web
cp .env.example .env   # optional: demo mode needs no configuration
npm install
npm run dev            # http://127.0.0.1:5173
```

Open `/demo` (or use **Try the demo** on the landing page) to explore with synthetic data and no backend.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` / `npm run preview` | Production build and local preview |
| `npm run typecheck` | `tsc --noEmit` over `src` and `e2e` |
| `npm test` | Unit tests (Vitest): pace, planner, deadlines, dates, demo data, contrast tokens |
| `npm run e2e` | Playwright against the production build, desktop and phone, plus axe-core accessibility |
| `npm run screenshots` | Regenerates `../assets/screenshots/` from demo mode |

Playwright needs a browser: `npx playwright install chromium`, or set `PW_CHANNEL=chrome` to use an
installed Chrome. `npm run screenshots` also needs one of those.

## Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_FUNCTIONS_URL=
VITE_ENABLE_EMAIL_OTP_FALLBACK=false
```

All are needed for real sign-in and data. Without them the app still builds and renders, demo mode works,
and a real call fails with a clear "Missing Supabase environment variables" error (the client is created on
first use). `VITE_ENABLE_EMAIL_OTP_FALLBACK=true` shows the development-only email fallback; production
keeps it false or unset.

## Source Layout

```text
src/
  app/            Routes, auth guards, providers
  pages/          Login (landing), AuthCallback, Main, History, Plan, Settings
  components/
    ui/           Card, Button, Banner, Stat, Skeleton, MiniRing
    main/         PaceHero, StaleDataBanner, AttendanceMonthCalendar
    plan/         PlanCalendar
    nav/          TabBar (phones), SideNav (desktop)
    marketing/    DashboardPreview for the landing page
  lib/            Pure logic and API adapters
    api/          dashboardApi, settingsApi, planApi (demo-aware)
  demo/           Demo mode: flag, synthetic fixtures, in-memory store
  styles/         Design tokens (globals.css) and the contrast test
e2e/              Playwright specs and the screenshot generator
```

Where the logic lives: `lib/pace.ts` (ahead or behind), `lib/planner.ts` (feasibility and suggestions),
`lib/deadlines.ts`, `lib/comparison.ts` (like-for-like week and month comparison), `lib/cumulative.ts`
(chart series), `lib/singaporeDate.ts` (all day keys are Singapore days).

## Design System

- Tokens are RGB channels in `src/styles/globals.css` (so Tailwind opacity modifiers like `bg-tt42-accent/15`
  work), with light and dark values and a single teal accent. Amber and red only mean "watch" and
  "behind / error".
- Inter Variable is self-hosted (Latin subset only). Hours use tabular numerals.
- Every text/background pair, including text on tinted backgrounds, is asserted AA in
  `src/styles/contrast.test.ts`.

## Runtime Dependencies

- Supabase Auth for browser sessions.
- RLS-protected tables for dashboard, history, goals, deadlines and plans.
- `forty-two-oauth-start`, `forty-two-oauth-callback` and `auth-exchange` for 42 sign-in.
- `forty-two-sync-manual` for **Sync now**.

## Cloudflare Pages

```text
Root directory: web
Build command: npm run build
Build output directory: dist
```

Set the frontend environment variables in Cloudflare Pages. Deploy previews render without them (demo mode
only); add them to the preview environment if you want real sign-in on previews.

The app is a PWA with a service worker, so the first visit after a deploy may show the previous version;
the next load shows the new one.

## Smoke Checklist

1. Landing page renders at `/login`; **Try the demo** opens the dashboard with a pace chip and four stat tiles.
2. Real login: **Continue with 42** -> 42 -> `/auth/callback` -> `/app/main`, with a single 200 from `auth-exchange`.
3. **Sync now** completes and updates the last-synced status.
4. History shows six months of totals.
5. Plan: tapping a day changes the plan; **Save plan** persists it.
6. Settings: goals and deadlines read and write through Supabase; deadlines show "Counted from ...".
7. The email fallback stays hidden unless `VITE_ENABLE_EMAIL_OTP_FALLBACK=true`.
8. `npm run typecheck && npm test && npm run build` and `npm run e2e` pass.
