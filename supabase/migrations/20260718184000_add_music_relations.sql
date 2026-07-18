create table if not exists music_relations (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,
  source_key text not null,
  target_kind text not null,
  target_key text not null,
  target_name text not null,
  target_artist text,
  similarity numeric(7,6) not null,
  provider text not null default 'lastfm',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + '7 days'::interval,
  constraint music_relations_source_kind_check check (source_kind = any (array['genre', 'artist', 'track'])),
  constraint music_relations_target_kind_check check (target_kind = any (array['genre', 'artist', 'track'])),
  constraint music_relations_provider_check check (provider = 'lastfm'),
  constraint music_relations_similarity_check check (similarity >= 0 and similarity <= 1),
  unique(source_kind, source_key, target_kind, target_key, provider)
);

create index if not exists music_relations_source_idx on music_relations (source_kind, source_key, expires_at);

alter table music_relations enable row level security;

create policy "Anyone can insert music_relations"
  on music_relations for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read music_relations"
  on music_relations for select
  to anon, authenticated
  using (true);

create policy "Anyone can update music_relations"
  on music_relations for update
  to anon, authenticated
  using (true);
