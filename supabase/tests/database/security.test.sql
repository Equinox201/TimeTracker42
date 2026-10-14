-- Run with: supabase test db
-- Verifies that the API roles cannot change identity mappings, read other users' rows,
-- or touch server-only tables.
begin;
select plan(21);

-- Two users, their profiles and some rows, created as the superuser role.
insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.profiles (id, forty_two_user_id, forty_two_login)
values
  ('00000000-0000-0000-0000-0000000000a1', 1001, 'user_a'),
  ('00000000-0000-0000-0000-0000000000b2', 1002, 'user_b');

insert into public.goals (user_id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');

insert into public.deadlines (user_id, title, due_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'A deadline', now() + interval '3 days'),
  ('00000000-0000-0000-0000-0000000000b2', 'B deadline', now() + interval '3 days');

insert into public.attendance_daily (user_id, day, seconds) values
  ('00000000-0000-0000-0000-0000000000a1', current_date, 3600),
  ('00000000-0000-0000-0000-0000000000b2', current_date, 7200);

insert into public.forty_two_tokens (user_id, access_token) values
  ('00000000-0000-0000-0000-0000000000a1', 'secret-a');

insert into public.oauth_states (state_hash, expires_at) values ('state-hash-1', now() + interval '10 minutes');
insert into public.auth_exchange_codes (code_hash, user_id, expires_at)
values ('code-hash-1', '00000000-0000-0000-0000-0000000000a1', now() + interval '5 minutes');

-- ===== Signed in as user A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'A sees only their own profile');
select is((select count(*)::int from public.goals), 1, 'A sees only their own goals');
select is((select count(*)::int from public.deadlines), 1, 'A sees only their own deadlines');
select is((select count(*)::int from public.attendance_daily), 1, 'A sees only their own attendance');

select throws_ok(
  $$update public.profiles set forty_two_user_id = 1002 where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'A cannot rewrite their own 42 identity mapping'
);
select throws_ok(
  $$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'A cannot update the profiles table at all'
);
select throws_ok(
  $$insert into public.profiles (id, forty_two_user_id) values (gen_random_uuid(), 9999)$$,
  '42501', null, 'A cannot insert profiles'
);

-- RLS makes B's row invisible to A, so this updates zero rows (checked below as service role).
update public.goals set daily_seconds = 1000 where user_id = '00000000-0000-0000-0000-0000000000b2';
select throws_ok(
  $$insert into public.deadlines (user_id, title, due_at)
    values ('00000000-0000-0000-0000-0000000000b2', 'planted', now())$$,
  '42501', null, 'A cannot create deadlines for user B (RLS WITH CHECK)'
);

select throws_ok(
  $$insert into public.attendance_daily (user_id, day, seconds)
    values ('00000000-0000-0000-0000-0000000000a1', current_date + 1, 99999)$$,
  '42501', null, 'A cannot write attendance'
);
select throws_ok($$select * from public.forty_two_tokens$$, '42501', null, 'A cannot read 42 tokens');
select throws_ok($$select * from public.oauth_states$$, '42501', null, 'A cannot read oauth_states');
select throws_ok($$select * from public.auth_exchange_codes$$, '42501', null, 'A cannot read auth_exchange_codes');

-- ===== Anonymous =====
reset role;
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.goals$$, '42501', null, 'anon cannot read goals');
select throws_ok($$select * from public.attendance_daily$$, '42501', null, 'anon cannot read attendance');

-- ===== Service role keeps working (Edge Functions rely on it) =====
reset role;
set local role service_role;
select is((select count(*)::int from public.profiles), 2, 'service role still reads all profiles');
select is(
  (select daily_seconds from public.goals where user_id = '00000000-0000-0000-0000-0000000000b2'),
  15120, 'A could not change user B goals'
);
select lives_ok(
  $$update public.profiles set display_name = 'set by edge function' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'service role can still write profiles'
);

-- ===== Default privileges for tables created in future migrations =====
reset role;
create table public.__acl_probe (id integer);

select ok(has_table_privilege('service_role', 'public.__acl_probe', 'select, insert, update, delete'),
  'new tables are fully accessible to the service role');
select ok(not has_table_privilege('authenticated', 'public.__acl_probe', 'select'),
  'new tables are not readable by authenticated until granted');
select ok(not has_table_privilege('anon', 'public.__acl_probe', 'select'),
  'new tables are not readable by anon until granted');

select * from finish();
rollback;
