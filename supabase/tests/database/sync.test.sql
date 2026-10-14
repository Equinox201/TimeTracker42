-- Run with: supabase test db
-- Covers the sync lock (one running sync per user) and the atomic finalize function.
begin;
select plan(12);

insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

-- ===== One running sync per user =====
insert into public.sync_runs (id, user_id, status)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'running');

select throws_ok(
  $$insert into public.sync_runs (user_id, status) values ('00000000-0000-0000-0000-0000000000a1', 'running')$$,
  '23505', null, 'a second running sync for the same user is rejected'
);
select lives_ok(
  $$insert into public.sync_runs (user_id, status) values ('00000000-0000-0000-0000-0000000000b2', 'running')$$,
  'another user can run a sync at the same time'
);
select lives_ok(
  $$insert into public.sync_runs (user_id, status, finished_at)
    values ('00000000-0000-0000-0000-0000000000a1', 'failed', now())$$,
  'finished runs do not count against the lock'
);

-- ===== finalize_sync =====
-- First sync: two sessions, two days.
create temp table first_result as
select * from public.finalize_sync(
  '00000000-0000-0000-0000-0000000000a1',
  '10000000-0000-0000-0000-000000000001',
  '[{"id":9001,"begin_at":"2026-10-13T01:00:00Z","end_at":"2026-10-13T03:00:00Z","host":"h1","campus_id":1,"primary_location":true},
    {"id":9002,"begin_at":"2026-10-14T01:00:00Z","end_at":null,"host":"h1","campus_id":1,"primary_location":true}]'::jsonb,
  '[{"day":"2026-10-13","seconds":7200,"source":"locations"},
    {"day":"2026-10-14","seconds":3600,"source":"locations_live"}]'::jsonb,
  '2026-10-14T05:00:00Z', '2026-10-14T05:00:01Z'
);

select results_eq(
  $$select inserted_days, updated_days, unchanged_days from first_result$$,
  $$values (2, 0, 0)$$,
  'first finalize inserts both days'
);
select is(
  (select count(*)::int from public.location_sessions where user_id = '00000000-0000-0000-0000-0000000000a1'),
  2, 'sessions were stored'
);
select is(
  (select status from public.sync_runs where id = '10000000-0000-0000-0000-000000000001'),
  'success', 'the run was closed in the same transaction'
);

-- Second sync with the same data, then a changed and a reconciled-to-zero day.
insert into public.sync_runs (id, user_id, status)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'running');

create temp table second_result as
select * from public.finalize_sync(
  '00000000-0000-0000-0000-0000000000a1',
  '10000000-0000-0000-0000-000000000002',
  '[]'::jsonb,
  '[{"day":"2026-10-13","seconds":0,"source":"locations"},
    {"day":"2026-10-14","seconds":3600,"source":"locations_live"}]'::jsonb,
  '2026-10-14T06:00:00Z', '2026-10-14T06:00:01Z'
);

select results_eq(
  $$select inserted_days, updated_days, unchanged_days from second_result$$,
  $$values (0, 1, 1)$$,
  'second finalize reports one reconciled day and one unchanged day'
);
select is(
  (select seconds from public.attendance_daily
    where user_id = '00000000-0000-0000-0000-0000000000a1' and day = '2026-10-13'),
  0, 'a day that vanished upstream was zeroed'
);

-- A run that is no longer running cannot be finalized, and nothing is written.
select throws_ok(
  $$select * from public.finalize_sync(
      '00000000-0000-0000-0000-0000000000a1',
      '10000000-0000-0000-0000-000000000002',
      '[]'::jsonb,
      '[{"day":"2026-10-20","seconds":999,"source":"locations"}]'::jsonb,
      now(), now())$$,
  'P0001', null, 'finalizing an already closed run fails'
);
select is(
  (select count(*)::int from public.attendance_daily
    where user_id = '00000000-0000-0000-0000-0000000000a1' and day = '2026-10-20'),
  0, 'the failed finalize rolled back its day write'
);

-- Another user's run id cannot be closed through this user id.
select throws_ok(
  $$select * from public.finalize_sync(
      '00000000-0000-0000-0000-0000000000b2',
      '10000000-0000-0000-0000-000000000001',
      '[]'::jsonb, '[]'::jsonb, now(), now())$$,
  'P0001', null, 'a run id belonging to another user is rejected'
);

-- ===== Only the service role may call it =====
set local role authenticated;
select throws_ok(
  $$select * from public.finalize_sync(
      '00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), '[]'::jsonb, '[]'::jsonb, now(), now())$$,
  '42501', null, 'authenticated users cannot execute finalize_sync'
);

select * from finish();
rollback;
