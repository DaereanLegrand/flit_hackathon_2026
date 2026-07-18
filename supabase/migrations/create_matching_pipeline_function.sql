-- =============================================================================
-- VIBE · 13_full_matching_pipeline.sql
-- Propósito:
--   Ejecutar en una sola consulta todas las etapas SQL implementadas del motor:
--   1) validar y normalizar preferencias;
--   2) encontrar coincidencias exactas;
--   3) encontrar gustos relacionados en el caché de Last.fm;
--   4) seleccionar semillas representativas;
--   5) combinar señales y calcular afinidad grupal;
--   6) aplicar cobertura, equidad, historial y exclusiones.
-- Sala: 9v8e9fYnBx1AjoKZ.
-- Resultado:
--   Una celda JSON llamada full_matching_pipeline con todas las etapas.
-- Modifica datos: no.
-- Requisitos:
--   Ejecutar antes 01_install_matching.sql y disponer de preferencias y
--   candidatos. Para una demostración completa, ejecutar 11_insert_demo_data.sql.
-- Limitación:
--   No llama a Internet. Usa las relaciones Last.fm que ya estén almacenadas en
--   music_relations y las puntuaciones previamente calculadas por el backend.
-- =============================================================================

create or replace function public.run_matching_pipeline(
    p_room_hash text,
    p_result_limit integer default 20
)
returns jsonb
language sql
security invoker
set search_path = public
as $function$

with
params as (
    select
        p_room_hash as room_hash,
        p_result_limit as result_limit,
        interval '6 hours' as recent_window,
        0.35::numeric as support_threshold,
        0.50::numeric as minimum_coverage
),

participants as (
    select rp.id, rp.nickname
    from room_participants rp
    join params p on p.room_hash = rp.qr_hash
),

-- 2. Validación y normalización local de las preferencias recibidas.
normalized_preferences as (
  select
    mp.id,
    mp.participant_id,
    pt.nickname,
    mp.kind,
    trim(regexp_replace(lower(mp.name), '\s+', ' ', 'g')) as normalized_name,
    case
      when mp.artist is null then null
      else trim(regexp_replace(lower(mp.artist), '\s+', ' ', 'g'))
    end as normalized_artist,
    trim(regexp_replace(lower(mp.canonical_key), '\s+', ' ', 'g')) as canonical_key,
    mp.name as display_name,
    mp.artist as display_artist,
    mp.weight,
    mp.source,
    (
      mp.kind in ('genre', 'artist', 'track')
      and nullif(trim(mp.name), '') is not null
      and nullif(trim(mp.canonical_key), '') is not null
      and mp.weight between 0 and 1
      and mp.room_hash = p.room_hash
    ) as is_valid,
    case
      when mp.kind not in ('genre', 'artist', 'track') then 'invalid_kind'
      when nullif(trim(mp.name), '') is null then 'empty_name'
      when nullif(trim(mp.canonical_key), '') is null then 'empty_canonical_key'
      when mp.weight not between 0 and 1 then 'invalid_weight'
      else null
    end as validation_error,
    mp.created_at
  from music_preferences mp
  join participants pt on pt.id = mp.participant_id
  cross join params p
  where mp.room_hash = p.room_hash
),

valid_preferences as (
  select *
  from normalized_preferences
  where is_valid
),

-- 3. Preferencias idénticas elegidas por dos o más participantes.
exact_matches as (
  select
    vp.kind,
    vp.canonical_key,
    min(vp.display_name) as display_name,
    count(distinct vp.participant_id) as matched_participants,
    round(avg(vp.weight), 4) as average_weight,
    round(
      count(distinct vp.participant_id)::numeric
      / nullif((select count(*) from participants), 0),
      4
    ) as coverage
  from valid_preferences vp
  group by vp.kind, vp.canonical_key
  having count(distinct vp.participant_id) >= 2
),

-- 4. Dos semillas por persona; primero una de cada participante y luego la segunda.
ranked_seeds as (
  select
    vp.*,
    row_number() over (
      partition by vp.participant_id
      order by vp.weight desc, vp.created_at asc
    ) as seed_rank
  from valid_preferences vp
),

representative_seeds as (
  select *
  from ranked_seeds
  where seed_rank <= 2
),

-- 5. Relaciones ya consultadas a Last.fm y todavía vigentes.
related_tastes as (
  select distinct
    vp.participant_id,
    vp.nickname,
    vp.kind as source_kind,
    vp.canonical_key as source_key,
    vp.display_name as source_name,
    mr.target_kind,
    mr.target_key,
    mr.target_name,
    mr.target_artist,
    mr.similarity
  from valid_preferences vp
  join music_relations mr
    on mr.source_kind = vp.kind
   and mr.source_key = vp.canonical_key
   and mr.expires_at > now()
),

-- 6. Marca el motivo por el que una candidata debe excluirse.
candidate_status as (
  select
    c.*,
    case
      when exists (
        select 1
        from room_music_exclusions e
        cross join params p
        where e.room_hash = c.room_hash
          and (e.track_key = c.track_key or e.artist_key = c.artist_key)
          and (e.expires_at is null or e.expires_at > now())
      ) then 'active_exclusion'
      when exists (
        select 1
        from room_track_history h
        cross join params p
        where h.room_hash = c.room_hash
          and h.track_key = c.track_key
          and h.created_at > now() - p.recent_window
      ) then 'recent_history'
      else null
    end as exclusion_reason
  from room_track_candidates c
  cross join params p
  where c.room_hash = p.room_hash
),

eligible_candidates as (
  select *
  from candidate_status
  where exclusion_reason is null
),

-- 7. Señales de afinidad. Se conserva la señal más fuerte por persona/canción.
affinity_signals as (
  -- Puntuaciones que el backend ya calculó y almacenó.
  select
    pcs.participant_id,
    pcs.candidate_id,
    pcs.score::numeric as signal_score,
    coalesce(pcs.strongest_signal, 'stored_score') as signal_type
  from participant_candidate_scores pcs
  join eligible_candidates c on c.id = pcs.candidate_id
  cross join params p
  where pcs.room_hash = p.room_hash

  union all

  -- Coincidencia directa con la canción.
  select
    vp.participant_id,
    c.id,
    least(1, vp.weight * 1.00)::numeric,
    'exact_track'
  from valid_preferences vp
  join eligible_candidates c
    on vp.kind = 'track'
   and vp.canonical_key = c.track_key

  union all

  -- Coincidencia directa con el artista.
  select
    vp.participant_id,
    c.id,
    least(1, vp.weight * 0.85)::numeric,
    'exact_artist'
  from valid_preferences vp
  join eligible_candidates c
    on vp.kind = 'artist'
   and vp.canonical_key = c.artist_key

  union all

  -- Relación inferida mediante el caché de Last.fm.
  select
    vp.participant_id,
    c.id,
    least(
      1,
      vp.weight * mr.similarity *
      case vp.kind
        when 'track' then 0.80
        when 'artist' then 0.65
        when 'genre' then 0.50
        else 0
      end
    )::numeric,
    'related_' || vp.kind
  from valid_preferences vp
  join music_relations mr
    on mr.source_kind = vp.kind
   and mr.source_key = vp.canonical_key
   and mr.target_kind = 'track'
   and mr.expires_at > now()
  join eligible_candidates c on c.track_key = mr.target_key
),

participant_candidate_affinity as (
  select
    s.participant_id,
    s.candidate_id,
    max(s.signal_score) as score,
    (array_agg(s.signal_type order by s.signal_score desc))[1] as strongest_signal
  from affinity_signals s
  group by s.participant_id, s.candidate_id
),

-- 8. Todos los participantes cuentan; si no tienen señal, reciben 0.
complete_scores as (
  select
    c.id as candidate_id,
    pt.id as participant_id,
    pt.nickname,
    coalesce(a.score, 0)::numeric as score,
    coalesce(a.strongest_signal, 'no_affinity') as strongest_signal
  from eligible_candidates c
  cross join participants pt
  left join participant_candidate_affinity a
    on a.candidate_id = c.id
   and a.participant_id = pt.id
),

-- 9. Agregación con promedio, cobertura y protección del grupo menos representado.
group_scores as (
  select
    cs.candidate_id,
    avg(cs.score)::numeric as average_affinity,
    min(cs.score)::numeric as minimum_affinity,
    (
      count(*) filter (where cs.score >= p.support_threshold)::numeric
      / nullif(count(*), 0)
    ) as coverage,
    percentile_cont(0.25) within group (order by cs.score)::numeric as lower_quartile,
    count(*) filter (where cs.score >= p.support_threshold) as represented_participants
  from complete_scores cs
  cross join params p
  group by cs.candidate_id
),

-- 10. Ranking final. La cobertura mínima evita recomendaciones individuales.
ranked_candidates as (
  select
    c.id as candidate_id,
    c.track_name,
    c.artist_name,
    c.track_key,
    c.lastfm_url,
    round(100 * (
      0.45 * gs.average_affinity
      + 0.25 * gs.coverage
      + 0.20 * gs.lower_quartile
      + 0.10 * gs.minimum_affinity
    ), 2) as group_affinity,
    round(gs.average_affinity, 4) as average_affinity,
    round(gs.minimum_affinity, 4) as minimum_affinity,
    round(gs.coverage, 4) as coverage,
    round(gs.lower_quartile, 4) as lower_quartile,
    gs.represented_participants
  from group_scores gs
  join eligible_candidates c on c.id = gs.candidate_id
  cross join params p
  where gs.coverage >= p.minimum_coverage
  order by group_affinity desc, coverage desc, average_affinity desc
  limit (select result_limit from params)
)

-- 11. Un único JSON permite inspeccionar todo el flujo desde DataGrip.
select jsonb_build_object(
    'room_hash', (select room_hash from params),
    'summary', jsonb_build_object(
        'participants', (select count(*) from participants),
        'preferences_received', (select count(*) from normalized_preferences),
        'valid_preferences', (select count(*) from valid_preferences),
        'exact_matches', (select count(*) from exact_matches),
        'related_tastes', (select count(*) from related_tastes),
        'candidates_received', (select count(*) from candidate_status),
        'eligible_candidates', (select count(*) from eligible_candidates),
        'ranked_candidates', (select count(*) from ranked_candidates)
    ),
    'group_ranking', coalesce(
        (
            select jsonb_agg(
                to_jsonb(rc)
                order by rc.group_affinity desc
            )
            from ranked_candidates rc
        ),
        '[]'::jsonb
    )
);

$function$;


revoke all on function public.run_matching_pipeline(text, integer)
from public;

grant execute on function public.run_matching_pipeline(text, integer)
to anon;