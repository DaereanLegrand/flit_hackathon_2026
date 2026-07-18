-- =============================================================================
-- VIBE · Agente musical diario
--
-- Crea el almacenamiento privado que necesita la Edge Function
-- `daily-dj-agent`: sesiones del cuestionario, candidatos reales obtenidos desde
-- Last.fm y la recomendación elegida por Groq.
--
-- Estas tablas son independientes del flujo grupal (salas, votos y matching).
-- RLS queda activo y no se crean políticas públicas: anon/authenticated no pueden
-- leer ni modificar estos datos directamente. La Edge Function accede mediante
-- service_role después de comprobar el token secreto de la sesión.
-- =============================================================================

create table if not exists public.daily_music_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null check (char_length(device_id) between 8 and 128),
  access_token uuid not null default gen_random_uuid(),
  session_day date not null default (timezone('utc', now())::date),
  status text not null default 'questioning'
    check (status in ('questioning', 'searching', 'completed')),
  answers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(answers) = 'array'),
  profile jsonb not null default '{}'::jsonb
    check (jsonb_typeof(profile) = 'object'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint daily_music_sessions_access_token_key unique (access_token),
  constraint daily_music_sessions_device_day_key unique (device_id, session_day)
);

create table if not exists public.daily_music_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.daily_music_sessions(id) on delete cascade,
  provider text not null default 'lastfm' check (provider = 'lastfm'),
  provider_key text not null,
  track_name text not null check (char_length(track_name) between 1 and 300),
  artist_name text not null check (char_length(artist_name) between 1 and 300),
  lastfm_url text,
  mbid text,
  source_type text not null
    check (source_type in ('tag_top', 'artist_top', 'similar_track')),
  source_value text not null,
  score numeric(6, 5) not null check (score between 0 and 1),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint daily_music_candidates_session_provider_key_key
    unique (session_id, provider_key)
);

create table if not exists public.daily_music_recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.daily_music_sessions(id) on delete cascade,
  primary_candidate_id uuid not null references public.daily_music_candidates(id),
  daily_vibe text not null check (char_length(daily_vibe) between 1 and 120),
  reason text not null check (char_length(reason) between 1 and 600),
  playlist jsonb not null check (jsonb_typeof(playlist) = 'array'),
  feedback text check (feedback in ('liked', 'disliked', 'another')),
  created_at timestamptz not null default now(),
  feedback_at timestamptz,
  constraint daily_music_recommendations_session_key unique (session_id)
);

create index if not exists daily_music_sessions_device_created_idx
  on public.daily_music_sessions (device_id, created_at desc);

create index if not exists daily_music_candidates_session_score_idx
  on public.daily_music_candidates (session_id, score desc);

create or replace function public.set_daily_music_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_daily_music_sessions_updated_at
  on public.daily_music_sessions;

create trigger set_daily_music_sessions_updated_at
before update on public.daily_music_sessions
for each row execute function public.set_daily_music_updated_at();

alter table public.daily_music_sessions enable row level security;
alter table public.daily_music_candidates enable row level security;
alter table public.daily_music_recommendations enable row level security;

revoke all on table public.daily_music_sessions from anon, authenticated;
revoke all on table public.daily_music_candidates from anon, authenticated;
revoke all on table public.daily_music_recommendations from anon, authenticated;

grant all on table public.daily_music_sessions to service_role;
grant all on table public.daily_music_candidates to service_role;
grant all on table public.daily_music_recommendations to service_role;

comment on table public.daily_music_sessions is
  'Sesiones privadas del cuestionario musical diario por dispositivo.';
comment on table public.daily_music_candidates is
  'Canciones reales recuperadas desde Last.fm para una sesión del agente.';
comment on table public.daily_music_recommendations is
  'Canción principal y playlist que el agente seleccionó entre los candidatos.';
