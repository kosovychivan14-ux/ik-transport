-- Kokos OAuth token store (Supabase free tier).
-- Run once in the Supabase SQL editor, then hand the project URL +
-- service_role key to the agent (never the anon key for this table).
create table if not exists public.kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Deny-by-default: no policies, so anon/authenticated roles see nothing.
-- service_role bypasses RLS and is the only key the backend uses.
alter table public.kv_store enable row level security;

-- Keep updated_at fresh on writes.
create or replace function public.kv_store_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists kv_store_touch on public.kv_store;
create trigger kv_store_touch
  before update on public.kv_store
  for each row execute function public.kv_store_touch();
