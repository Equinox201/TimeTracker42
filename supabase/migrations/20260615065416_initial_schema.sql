create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  forty_two_user_id bigint unique,
  forty_two_login text unique,
  display_name text,
  campus_id bigint,
  timezone text not null default 'Asia/Singapore',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forty_two_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds >= 0),
  source text not null default 'locations_stats',
  synced_at timestamptz not null default now(),
  unique(user_id, day)
);

create table public.location_sessions (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  begin_at timestamptz not null,
  end_at timestamptz,
  host text,
  campus_id bigint,
  primary_location boolean,
  synced_at timestamptz not null default now()
);

create table public.goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_seconds integer not null default 324000 check (monthly_seconds > 0),
  weekly_seconds integer not null default 75600 check (weekly_seconds > 0),
  daily_seconds integer not null default 15120 check (daily_seconds > 0),
  days_per_week integer not null default 5 check (days_per_week between 1 and 7),
  pace_mode text not null default 'weekdays' check (pace_mode in ('all_days', 'weekdays')),
  updated_at timestamptz not null default now()
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  due_at timestamptz not null,
  target_seconds integer check (target_seconds is null or target_seconds >= 0),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('success', 'failed', 'running')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

alter table public.profiles enable row level security;
alter table public.forty_two_tokens enable row level security;
alter table public.attendance_daily enable row level security;
alter table public.location_sessions enable row level security;
alter table public.goals enable row level security;
alter table public.deadlines enable row level security;
alter table public.sync_runs enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Users can read own attendance"
on public.attendance_daily for select
using (auth.uid() = user_id);

create policy "Users can read own location sessions"
on public.location_sessions for select
using (auth.uid() = user_id);

create policy "Users can manage own goals"
on public.goals for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own deadlines"
on public.deadlines for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own sync runs"
on public.sync_runs for select
using (auth.uid() = user_id);

-- Tokens should not be directly readable by frontend users.
-- Edge Functions with service role can access them.