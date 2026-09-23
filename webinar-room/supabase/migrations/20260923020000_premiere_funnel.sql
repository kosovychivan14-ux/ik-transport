create table if not exists public.premiere_contacts (
  telegram_id text primary key,
  sendpulse_contact_id text not null default '',
  user_name text not null default '',
  username text not null default '',
  funnel_started_at timestamptz,
  funnel_stage text not null default '',
  funnel_status text not null default 'active',
  eligible boolean not null default false,
  webinar_at timestamptz,
  reminder_sent_at timestamptz,
  room_link_sent_at timestamptz,
  room_opened_at timestamptz,
  unsubscribed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.premiere_webhook_events (
  event_key text primary key,
  event_type text not null,
  telegram_id text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists premiere_contacts_webinar_idx on public.premiere_contacts (webinar_at) where eligible and not unsubscribed;
create index if not exists premiere_events_received_idx on public.premiere_webhook_events (received_at desc);

alter table public.premiere_contacts enable row level security;
alter table public.premiere_webhook_events enable row level security;
revoke all on table public.premiere_contacts, public.premiere_webhook_events from anon, authenticated;
grant select, insert, update on table public.premiere_contacts to anon;
grant select, insert on table public.premiere_webhook_events to anon;

-- Production policies compare a generated SHA-256 hash of the private
-- x-analytics-secret header. The plain secret is never committed.
