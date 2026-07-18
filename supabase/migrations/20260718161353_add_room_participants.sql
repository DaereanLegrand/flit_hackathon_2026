create table if not exists room_participants (
  id uuid primary key default gen_random_uuid(),
  qr_hash text not null references qr_codes(hash),
  device_id text not null,
  nickname text,
  created_at timestamptz not null default now(),
  unique(qr_hash, device_id)
);

alter table room_participants enable row level security;

create policy "Anyone can insert room_participants"
  on room_participants for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read room_participants"
  on room_participants for select
  to anon, authenticated
  using (true);
