create extension if not exists pgcrypto;

create table if not exists public.webinar_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('room_open','heartbeat','room_close','section_view','recording_start','recording_progress','recording_pause','recording_end','slide_change','question','cta_click')),
  actor_role text not null check (actor_role in ('viewer','presenter')),
  telegram_id text not null,
  user_name text not null default '',
  username text not null default '',
  session_id uuid not null,
  webinar_id text not null default 'main',
  recording_id text,
  slide_number integer check (slide_number is null or slide_number > 0),
  watch_seconds integer not null default 0 check (watch_seconds >= 0),
  position_seconds integer check (position_seconds is null or position_seconds >= 0),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists webinar_events_occurred_at_idx on public.webinar_events (occurred_at desc);
create index if not exists webinar_events_telegram_idx on public.webinar_events (telegram_id, occurred_at desc);
create index if not exists webinar_events_session_idx on public.webinar_events (session_id, occurred_at);
create index if not exists webinar_events_recording_idx on public.webinar_events (recording_id, occurred_at desc) where recording_id is not null;

alter table public.webinar_events enable row level security;
revoke all on table public.webinar_events from anon, authenticated;
grant select, insert on table public.webinar_events to anon;

-- Production adds two RLS policies whose SHA-256 comparison value is generated
-- during setup. The plain analytics secret is stored only in Vercel environment
-- variables and is never committed to this repository.
