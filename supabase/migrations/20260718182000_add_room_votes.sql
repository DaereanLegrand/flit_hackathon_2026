create table if not exists room_votes (
  id uuid primary key default gen_random_uuid(),
  qr_hash text not null references qr_codes(hash),
  device_id text not null,
  title text not null,
  artist text not null,
  cover_url text,
  created_at timestamptz not null default now(),
  unique(qr_hash, device_id, title, artist)
);

alter table room_votes enable row level security;

create policy "Anyone can insert room_votes"
  on room_votes for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read room_votes"
  on room_votes for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table room_votes;
