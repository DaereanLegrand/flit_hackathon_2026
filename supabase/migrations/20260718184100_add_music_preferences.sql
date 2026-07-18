create table if not exists music_preferences (
  id uuid primary key default gen_random_uuid(),
  room_hash text not null references qr_codes(hash) on delete cascade,
  participant_id uuid not null references room_participants(id) on delete cascade,
  kind text not null,
  name text not null,
  artist text,
  mbid text,
  canonical_key text not null,
  weight numeric(5,4) not null default 0.7,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint music_preferences_kind_check check (kind = any (array['genre', 'artist', 'track'])),
  constraint music_preferences_source_check check (source = any (array['manual', 'lastfm'])),
  constraint music_preferences_weight_check check (weight >= 0 and weight <= 1),
  unique(participant_id, kind, canonical_key)
);

create index if not exists music_preferences_room_idx on music_preferences (room_hash, kind, canonical_key);

alter table music_preferences enable row level security;

create policy "Anyone can insert music_preferences"
  on music_preferences for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read music_preferences"
  on music_preferences for select
  to anon, authenticated
  using (true);

create policy "Anyone can update music_preferences"
  on music_preferences for update
  to anon, authenticated
  using (true);
