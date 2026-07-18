create table if not exists participant_candidate_scores (
  id uuid primary key default gen_random_uuid(),
  room_hash text not null references qr_codes(hash) on delete cascade,
  participant_id uuid not null references room_participants(id) on delete cascade,
  candidate_id uuid not null references room_track_candidates(id) on delete cascade,
  score numeric(7,6) not null,
  strongest_signal text,
  reasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint participant_candidate_scores_score_check check (score >= 0 and score <= 1),
  unique(participant_id, candidate_id)
);

create index if not exists participant_candidate_scores_room_idx on participant_candidate_scores (room_hash, candidate_id, participant_id);

alter table participant_candidate_scores enable row level security;

create policy "Anyone can insert participant_candidate_scores"
  on participant_candidate_scores for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read participant_candidate_scores"
  on participant_candidate_scores for select
  to anon, authenticated
  using (true);

create policy "Anyone can update participant_candidate_scores"
  on participant_candidate_scores for update
  to anon, authenticated
  using (true);
