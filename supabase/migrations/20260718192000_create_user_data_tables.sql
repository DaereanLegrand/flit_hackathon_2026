create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  telegram_user_id bigint,
  telegram_chat_id bigint,
  timezone text not null default 'America/Lima',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_listening_history (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  kind text not null check (kind in ('artist', 'track', 'genre')),
  name text not null,
  artist text,
  mbid text,
  source text not null default 'hardcoded' check (source in ('hardcoded', 'lastfm', 'spotify')),
  score numeric(6,5) not null default 0.5,
  created_at timestamptz not null default now(),
  unique(device_id, kind, name, artist)
);

create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  session_id uuid references public.daily_music_sessions(id) on delete set null,
  candidate_id uuid references public.daily_music_candidates(id) on delete set null,
  interaction_type text not null check (interaction_type in ('liked', 'disliked', 'skipped', 'played', 'saved')),
  track_name text not null,
  artist_name text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_chat_context (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  telegram_message_id bigint,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) between 1 and 4096),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  source text not null check (source in ('telegram', 'email', 'calendar', 'system', 'hardcoded')),
  title text not null,
  body text,
  category text,
  importance text not null default 'normal' check (importance in ('low', 'normal', 'high', 'urgent')),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists user_listening_history_device_idx
  on public.user_listening_history (device_id, source, score desc);

create index if not exists user_interactions_device_idx
  on public.user_interactions (device_id, created_at desc);

create index if not exists telegram_chat_context_device_idx
  on public.telegram_chat_context (device_id, created_at desc);

create index if not exists user_notifications_device_idx
  on public.user_notifications (device_id, created_at desc, is_read);

alter table public.user_profiles enable row level security;
alter table public.user_listening_history enable row level security;
alter table public.user_interactions enable row level security;
alter table public.telegram_chat_context enable row level security;
alter table public.user_notifications enable row level security;

grant all on table public.user_profiles to service_role;
grant all on table public.user_listening_history to service_role;
grant all on table public.user_interactions to service_role;
grant all on table public.telegram_chat_context to service_role;
grant all on table public.user_notifications to service_role;
