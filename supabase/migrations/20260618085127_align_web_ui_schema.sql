-- Align the Supabase schema with the current web UI contract before moving
-- frontend API calls off the legacy FastAPI backend.

alter table public.deadlines
add column if not exists is_completed boolean not null default false;

comment on column public.deadlines.is_completed is
'Completion state used by the web settings deadline list.';

comment on column public.deadlines.due_at is
'Date-only UI values should be stored as UTC midnight timestamptz from YYYY-MM-DD and read back with the UTC date portion, e.g. due_at.toISOString().slice(0, 10).';

-- Keep one current goal row per user. user_id remains the primary key; the
-- web UI does not need a separate goal id, effective_from, or is_active field.
alter table public.goals
drop constraint if exists goals_pace_mode_check;

update public.goals
set pace_mode = 'calendar_days'
where pace_mode = 'all_days';

alter table public.goals
add constraint goals_pace_mode_check
check (pace_mode in ('calendar_days', 'weekdays'));

comment on column public.goals.pace_mode is
'calendar_days counts every calendar day toward pace; weekdays counts only weekday attendance targets.';

-- RLS policies continue to rely on auth.uid() = user_id and do not require
-- changes for these column/constraint updates.

create index if not exists deadlines_user_due_at_idx
on public.deadlines (user_id, due_at);

-- attendance_daily already has a unique(user_id, day) index from the initial
-- schema, which supports the dashboard/history user-scoped date range queries.
