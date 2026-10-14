-- Planner support and a correct deadline model.

-- 1. Deadlines measure attendance from their own start date, not "this month so far".
alter table public.deadlines
  add column if not exists start_on date;

update public.deadlines
set start_on = (created_at at time zone 'Asia/Singapore')::date
where start_on is null;

alter table public.deadlines
  alter column start_on set not null,
  alter column start_on set default ((now() at time zone 'Asia/Singapore')::date);

comment on column public.deadlines.start_on is
'First Singapore day counted toward this deadline''s target_seconds. Progress = attendance from start_on to due_at.';

-- 2. A saved attendance plan per user and month: which weekdays they can attend, specific
--    extra days, days off, and a cap on hours per day. The target itself comes from goals.
create table public.attendance_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  weekdays smallint[] not null default '{1,2,3,4,5}'
    check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  extra_days date[] not null default '{}'
    check (cardinality(extra_days) <= 31),
  excluded_days date[] not null default '{}'
    check (cardinality(excluded_days) <= 31),
  max_hours_per_day numeric(4,2) not null default 8
    check (max_hours_per_day > 0 and max_hours_per_day <= 24),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

comment on table public.attendance_plans is
'Per-user, per-month attendance schedule used by the planner. Users manage only their own rows.';

alter table public.attendance_plans enable row level security;

create policy "Users manage own attendance plans"
on public.attendance_plans for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Default privileges give API roles nothing on new tables (see lock_down_identity migration).
grant select, insert, update, delete on public.attendance_plans to authenticated;
