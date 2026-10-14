-- Sync correctness: at most one running sync per user, and an atomic finalize.

-- Runs that died before finishing stay 'running' forever and would now block the user's
-- next sync. Close any that predate this migration.
update public.sync_runs
set status = 'failed',
    finished_at = coalesce(finished_at, now()),
    error = coalesce(error, 'Sync did not finish.')
where status = 'running';

-- One in-flight sync per user. A second concurrent start violates this index (SQLSTATE
-- 23505), which the function reports as "already running".
create unique index if not exists sync_runs_one_running_per_user_idx
on public.sync_runs (user_id)
where status = 'running';

-- Persists one sync result in a single transaction: location sessions, daily totals and
-- the run status either all land or none do. p_days carries every day to write, including
-- days reconciled down to 0 seconds. Returns how many days were inserted/updated/unchanged.
create or replace function public.finalize_sync(
  p_user_id uuid,
  p_run_id uuid,
  p_sessions jsonb,
  p_days jsonb,
  p_synced_at timestamptz,
  p_finished_at timestamptz
)
returns table (inserted_days integer, updated_days integer, unchanged_days integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted integer;
  v_updated integer;
  v_unchanged integer;
  v_closed integer;
begin
  insert into public.location_sessions
    (id, user_id, begin_at, end_at, host, campus_id, primary_location, synced_at)
  select s.id, p_user_id, s.begin_at, s.end_at, s.host, s.campus_id, s.primary_location, p_synced_at
  from jsonb_to_recordset(p_sessions) as s(
    id bigint, begin_at timestamptz, end_at timestamptz, host text,
    campus_id bigint, primary_location boolean
  )
  on conflict (id) do update
    set begin_at = excluded.begin_at,
        end_at = excluded.end_at,
        host = excluded.host,
        campus_id = excluded.campus_id,
        primary_location = excluded.primary_location,
        synced_at = excluded.synced_at
    where public.location_sessions.user_id = excluded.user_id;

  select
    count(*) filter (where e.day is null),
    count(*) filter (where e.day is not null and (e.seconds <> i.seconds or e.source <> i.source)),
    count(*) filter (where e.day is not null and e.seconds = i.seconds and e.source = i.source)
  into v_inserted, v_updated, v_unchanged
  from jsonb_to_recordset(p_days) as i(day date, seconds integer, source text)
  left join public.attendance_daily e
    on e.user_id = p_user_id and e.day = i.day;

  insert into public.attendance_daily (user_id, day, seconds, source, synced_at)
  select p_user_id, d.day, d.seconds, d.source, p_synced_at
  from jsonb_to_recordset(p_days) as d(day date, seconds integer, source text)
  on conflict (user_id, day) do update
    set seconds = excluded.seconds,
        source = excluded.source,
        synced_at = excluded.synced_at;

  update public.sync_runs
  set status = 'success', finished_at = p_finished_at, error = null
  where id = p_run_id and user_id = p_user_id and status = 'running';
  get diagnostics v_closed = row_count;

  if v_closed <> 1 then
    -- Roll everything back: the run was already closed (for example recovered as abandoned).
    raise exception 'sync run % is not running', p_run_id using errcode = 'P0001';
  end if;

  return query select v_inserted, v_updated, v_unchanged;
end;
$$;

comment on function public.finalize_sync(uuid, uuid, jsonb, jsonb, timestamptz, timestamptz) is
'Atomically stores a manual sync result. Service role only; called by the forty-two-sync-manual Edge Function.';

revoke execute on function public.finalize_sync(uuid, uuid, jsonb, jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_sync(uuid, uuid, jsonb, jsonb, timestamptz, timestamptz)
  to service_role;
