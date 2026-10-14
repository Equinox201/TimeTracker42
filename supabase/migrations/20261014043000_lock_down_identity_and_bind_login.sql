-- Security hardening: lock the 42 identity mapping and bind login transactions to the
-- browser that started them.
--
-- Background: the callback Edge Function selects the application account by
-- profiles.forty_two_user_id. Supabase grants the API roles broad table privileges by
-- default, and the "Users can update own profile" policy had no column restriction or
-- WITH CHECK, so a signed-in user could rewrite their own forty_two_user_id and capture
-- another student's next login. Only Edge Functions (service role) write these tables.

-- 1. Identity mapping: profiles become read-only for API roles.
drop policy if exists "Users can update own profile" on public.profiles;

-- 2. Least privilege. Start from nothing for the API roles, then grant back exactly what
--    the web app uses. The service role is unaffected.
revoke all on all tables in schema public from anon, authenticated;

-- The Edge Functions (service role) are the only writers of server-owned tables. Make that
-- explicit instead of relying on default privileges, which this migration changes below.
grant all on all tables in schema public to service_role;

grant select on public.profiles to authenticated;
grant select on public.attendance_daily to authenticated;
grant select on public.location_sessions to authenticated;
grant select on public.sync_runs to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.deadlines to authenticated;
-- forty_two_tokens, oauth_states and auth_exchange_codes stay unreachable for API roles.

-- New tables must opt in to API access explicitly. State the end result outright instead of
-- relying on whatever defaults an environment started with (a fresh local database ended up
-- with service_role missing SELECT/INSERT/UPDATE/DELETE on tables created later).
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;

-- 3. rls_auto_enable() is an event-trigger helper; it should not be callable via /rpc.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- 4. Browser binding (see supabase/functions/_shared/binding.ts).
alter table public.oauth_states
  add column if not exists binding_hash text;

alter table public.auth_exchange_codes
  add column if not exists binding_hash text;

comment on column public.oauth_states.binding_hash is
'SHA-256 (base64url) of a verifier kept by the browser that started the login. Null for logins started before binding existed.';

comment on column public.auth_exchange_codes.binding_hash is
'Copied from oauth_states.binding_hash. auth-exchange only redeems the code for a caller presenting the matching verifier.';
