-- Run with: supabase test db
-- Attendance plans are per-user, validated, and deadlines get a start date.
begin;
select plan(10);

insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.attendance_plans (user_id, month, max_hours_per_day)
values ('00000000-0000-0000-0000-0000000000b2', '2026-10', 6);

-- ===== As user A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.attendance_plans (user_id, month, weekdays, excluded_days, max_hours_per_day)
    values ('00000000-0000-0000-0000-0000000000a1', '2026-10', '{1,3,5}', '{2026-10-21}', 5.5)$$,
  'A can save their own plan'
);
select is(
  (select count(*)::int from public.attendance_plans), 1, 'A sees only their own plans'
);
select throws_ok(
  $$insert into public.attendance_plans (user_id, month) values ('00000000-0000-0000-0000-0000000000b2', '2026-11')$$,
  '42501', null, 'A cannot create a plan for B'
);
select lives_ok(
  $$update public.attendance_plans set max_hours_per_day = 7 where user_id = '00000000-0000-0000-0000-0000000000a1'$$,
  'A can update their own plan'
);
select throws_ok(
  $$insert into public.attendance_plans (user_id, month, weekdays)
    values ('00000000-0000-0000-0000-0000000000a1', '2026-11', '{0,8}')$$,
  '23514', null, 'weekdays outside 1-7 are rejected'
);
select throws_ok(
  $$insert into public.attendance_plans (user_id, month, max_hours_per_day)
    values ('00000000-0000-0000-0000-0000000000a1', '2026-12', 30)$$,
  '23514', null, 'more than 24 hours per day is rejected'
);
select throws_ok(
  $$insert into public.attendance_plans (user_id, month)
    values ('00000000-0000-0000-0000-0000000000a1', 'October')$$,
  '23514', null, 'a malformed month is rejected'
);

-- ===== Deadlines get a start date =====
select lives_ok(
  $$insert into public.deadlines (user_id, title, due_at)
    values ('00000000-0000-0000-0000-0000000000a1', 'Project', now() + interval '7 days')$$,
  'a deadline can be created without naming a start date'
);
select is(
  (select start_on from public.deadlines where title = 'Project'),
  (now() at time zone 'Asia/Singapore')::date,
  'start_on defaults to today in Singapore'
);

-- ===== Anonymous =====
reset role;
set local role anon;
select throws_ok($$select * from public.attendance_plans$$, '42501', null, 'anon cannot read plans');

select * from finish();
rollback;
