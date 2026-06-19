-- Internal Edge Function auth support tables.
-- These tables are intentionally not exposed to frontend clients. RLS is
-- enabled and no frontend policies are added; Edge Functions will access them
-- with the Supabase service role key.

create table public.oauth_states (
  state_hash text primary key,
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

comment on table public.oauth_states is
'Internal service-role table for 42 OAuth state hashes. Used to validate OAuth callbacks and prevent CSRF/replay attacks.';

comment on column public.oauth_states.state_hash is
'Hash of the random OAuth state value. The raw state is sent through the browser; only the hash is stored.';

comment on column public.oauth_states.redirect_to is
'Optional frontend redirect target captured at login start. Edge Functions must validate this against an allowlist before use.';

comment on column public.oauth_states.expires_at is
'State values must be short lived and rejected after this timestamp.';

comment on column public.oauth_states.used_at is
'Set when a state value is consumed so replayed callbacks can be rejected.';

create index oauth_states_expires_at_idx
on public.oauth_states (expires_at);

create index oauth_states_used_at_idx
on public.oauth_states (used_at);

alter table public.oauth_states enable row level security;

create table public.auth_exchange_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

comment on table public.auth_exchange_codes is
'Internal service-role table for short-lived one-time codes issued after successful 42 OAuth. Frontend redeems the raw code through an Edge Function and never receives 42 tokens.';

comment on column public.auth_exchange_codes.code_hash is
'Hash of the one-time exchange code. The raw code may be returned to the frontend callback URL; only the hash is stored.';

comment on column public.auth_exchange_codes.user_id is
'Supabase Auth user linked to the successful 42 OAuth callback.';

comment on column public.auth_exchange_codes.expires_at is
'Exchange codes must be short lived and rejected after this timestamp.';

comment on column public.auth_exchange_codes.used_at is
'Set when a code is redeemed so replay attempts can be rejected.';

create index auth_exchange_codes_user_id_idx
on public.auth_exchange_codes (user_id);

create index auth_exchange_codes_expires_at_idx
on public.auth_exchange_codes (expires_at);

create index auth_exchange_codes_used_at_idx
on public.auth_exchange_codes (used_at);

alter table public.auth_exchange_codes enable row level security;
