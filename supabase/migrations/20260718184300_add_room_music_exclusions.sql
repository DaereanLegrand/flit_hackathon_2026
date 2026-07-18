create table if not exists room_music_exclusions (
  id uuid primary key default gen_random_uuid(),
  room_hash text not null references qr_codes(hash) on delete cascade,
  participant_id uuid references room_participants(id) on delete cascade,
  track_key text,
  artist_key text,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint room_music_exclusions_check check (track_key is not null or artist_key is not null),
  constraint room_music_exclusions_reason_check check (reason = any (array['dislike', 'rejected', 'duplicate', 'explicit', 'manual']))
);

create index if not exists room_music_exclusions_room_idx on room_music_exclusions (room_hash, track_key, artist_key, expires_at);

alter table room_music_exclusions enable row level security;

create policy "Anyone can insert room_music_exclusions"
  on room_music_exclusions for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read room_music_exclusions"
  on room_music_exclusions for select
  to anon, authenticated
  using (true);

create policy "Anyone can update room_music_exclusions"
  on room_music_exclusions for update
  to anon, authenticated
  using (true);
