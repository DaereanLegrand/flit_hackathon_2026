create table if not exists room_track_history (
  id uuid primary key default gen_random_uuid(),
  room_hash text not null references qr_codes(hash) on delete cascade,
  candidate_id uuid references room_track_candidates(id) on delete set null,
  track_key text not null,
  artist_key text not null,
  status text not null,
  created_at timestamptz not null default now(),
  constraint room_track_history_status_check check (status = any (array['proposed', 'approved', 'rejected', 'played', 'skipped']))
);

create index if not exists room_track_history_recent_idx on room_track_history (room_hash, created_at desc, track_key);

alter table room_track_history enable row level security;

create policy "Anyone can insert room_track_history"
  on room_track_history for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read room_track_history"
  on room_track_history for select
  to anon, authenticated
  using (true);

create policy "Anyone can update room_track_history"
  on room_track_history for update
  to anon, authenticated
  using (true);
