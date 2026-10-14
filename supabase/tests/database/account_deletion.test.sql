-- Run with: supabase test db
-- Deleting an auth user (what the delete-account function does) must remove every row that
-- belongs to them, and only theirs.
begin;
select plan(10);

insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

-- One row of every kind for each of the two users.
insert into public.profiles (id, forty_two_user_id, forty_two_login) values
  ('00000000-0000-0000-0000-0000000000a1', 1001, 'user_a'),
  ('00000000-0000-0000-0000-0000000000b2', 1002, 'user_b');
insert into public.forty_two_tokens (user_id, access_token) values
  ('00000000-0000-0000-0000-0000000000a1', 'token-a'),
  ('00000000-0000-0000-0000-0000000000b2', 'token-b');
insert into public.attendance_daily (user_id, day, seconds) values
  ('00000000-0000-0000-0000-0000000000a1', '2026-10-01', 3600),
  ('00000000-0000-0000-0000-0000000000b2', '2026-10-01', 7200);
insert into public.location_sessions (id, user_id, begin_at) values
  (7001, '00000000-0000-0000-0000-0000000000a1', '2026-10-01T01:00:00Z'),
  (7002, '00000000-0000-0000-0000-0000000000b2', '2026-10-01T01:00:00Z');
insert into public.goals (user_id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.deadlines (user_id, title, due_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'A', now() + interval '3 days'),
  ('00000000-0000-0000-0000-0000000000b2', 'B', now() + interval '3 days');
insert into public.sync_runs (user_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'success'),
  ('00000000-0000-0000-0000-0000000000b2', 'success');
insert into public.attendance_plans (user_id, month) values
  ('00000000-0000-0000-0000-0000000000a1', '2026-10'),
  ('00000000-0000-0000-0000-0000000000b2', '2026-10');
insert into public.auth_exchange_codes (code_hash, user_id, expires_at) values
  ('code-a', '00000000-0000-0000-0000-0000000000a1', now() + interval '5 minutes'),
  ('code-b', '00000000-0000-0000-0000-0000000000b2', now() + interval '5 minutes');

delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';

select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 0, 'profile removed');
select is((select count(*)::int from public.forty_two_tokens where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, '42 tokens removed');
select is((select count(*)::int from public.attendance_daily where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'attendance removed');
select is((select count(*)::int from public.location_sessions where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'sessions removed');
select is((select count(*)::int from public.goals where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'goals removed');
select is((select count(*)::int from public.deadlines where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'deadlines removed');
select is((select count(*)::int from public.sync_runs where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'sync runs removed');
select is((select count(*)::int from public.attendance_plans where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'plans removed');
select is((select count(*)::int from public.auth_exchange_codes where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'pending exchange codes removed');

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000b2')
  + (select count(*)::int from public.attendance_daily where user_id = '00000000-0000-0000-0000-0000000000b2')
  + (select count(*)::int from public.goals where user_id = '00000000-0000-0000-0000-0000000000b2'),
  3, 'the other user keeps their rows'
);

select * from finish();
rollback;
