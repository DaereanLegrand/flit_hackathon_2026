create table if not exists qr_codes (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  created_at timestamptz not null default now()
);

alter table qr_codes enable row level security;

create policy "Anyone can insert qr_codes"
  on qr_codes for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read qr_codes"
  on qr_codes for select
  to anon, authenticated
  using (true);
