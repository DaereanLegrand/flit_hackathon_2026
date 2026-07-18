create table if not exists room_track_candidates (
  id uuid primary key default gen_random_uuid(),
  room_hash text not null references qr_codes(hash) on delete cascade,
  track_key text not null,
  artist_key text not null,
  track_name text not null,
  artist_name text not null,
  mbid text,
  lastfm_url text,
  is_explicit boolean,
  seed_source text not null default 'related',
  created_at timestamptz not null default now(),
  unique(room_hash, track_key)
);

create index if not exists room_track_candidates_room_idx on room_track_candidates (room_hash, created_at);

alter table room_track_candidates enable row level security;

create policy "Anyone can insert room_track_candidates"
  on room_track_candidates for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read room_track_candidates"
  on room_track_candidates for select
  to anon, authenticated
  using (true);

create policy "Anyone can update room_track_candidates"
  on room_track_candidates for update
  to anon, authenticated
  using (true);
