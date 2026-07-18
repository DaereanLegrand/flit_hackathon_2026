const LASTFM_URL = "https://ws.audioscrobbler.com/2.0/"

export interface MusicSearchInput {
  desired_tags: string[]
  seed_artist?: string | null
  seed_track?: string | null
}

export interface LastFmCandidate {
  provider: "lastfm"
  provider_key: string
  track_name: string
  artist_name: string
  lastfm_url: string | null
  mbid: string | null
  source_type: "tag_top" | "artist_top" | "similar_track"
  source_value: string
  score: number
  metadata: Record<string, unknown>
}

function clean(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export function canonicalMusicKey(artist: string, track: string): string {
  return `${artist}::${track}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 600)
}

function imageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  const valid = images
    .map((image) => clean((image as Record<string, unknown>)?.["#text"], 1000))
    .filter(Boolean)
  return valid.at(-1) ?? null
}

async function lastFmRequest(
  apiKey: string,
  method: string,
  params: Record<string, string | number>,
  attempt = 0,
): Promise<Record<string, any>> {
  const url = new URL(LASTFM_URL)
  url.searchParams.set("method", method)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("format", "json")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  } catch (error) {
    if (attempt === 0) return lastFmRequest(apiKey, method, params, 1)
    throw new Error(`Last.fm no respondió: ${error instanceof Error ? error.message : "timeout"}`)
  }

  const body = await response.json().catch(() => ({}))
  const retryable = !response.ok || body?.error === 11 || body?.error === 16
  if (retryable && attempt === 0) {
    return lastFmRequest(apiKey, method, params, 1)
  }
  if (!response.ok || body?.error) {
    throw new Error(`Last.fm rechazó ${method}: ${clean(body?.message, 200) || response.status}`)
  }
  return body
}

function toCandidate(
  track: Record<string, any>,
  sourceType: LastFmCandidate["source_type"],
  sourceValue: string,
  score: number,
): LastFmCandidate | null {
  const trackName = clean(track?.name)
  const artistName = clean(
    typeof track?.artist === "string" ? track.artist : track?.artist?.name,
  )
  if (!trackName || !artistName) return null

  return {
    provider: "lastfm",
    provider_key: canonicalMusicKey(artistName, trackName),
    track_name: trackName,
    artist_name: artistName,
    lastfm_url: clean(track?.url, 1000) || null,
    mbid: clean(track?.mbid, 100) || null,
    source_type: sourceType,
    source_value: sourceValue.slice(0, 300),
    score: Math.max(0, Math.min(1, Number(score.toFixed(5)))),
    metadata: {
      image_url: imageUrl(track?.image),
      listeners: Number(track?.listeners || 0) || null,
      playcount: Number(track?.playcount || 0) || null,
    },
  }
}

export async function searchLastFmCandidates(
  apiKey: string,
  input: MusicSearchInput,
): Promise<LastFmCandidate[]> {
  const tags = [...new Set(input.desired_tags.map((tag) => clean(tag, 60)).filter(Boolean))].slice(0, 3)
  const seedArtist = clean(input.seed_artist, 300)
  const seedTrack = clean(input.seed_track, 300)
  if (tags.length === 0 && !seedArtist) {
    throw new Error("El agente debe proporcionar al menos un tag o artista semilla")
  }

  const requests: Promise<LastFmCandidate[]>[] = []
  for (const tag of tags) {
    requests.push(
      lastFmRequest(apiKey, "tag.getTopTracks", { tag, limit: 12, page: 1 })
        .then((body) => (body?.tracks?.track ?? []).map((track: any, index: number) =>
          toCandidate(track, "tag_top", tag, 0.82 - index * 0.012)
        ).filter(Boolean)),
    )
  }

  if (seedArtist) {
    requests.push(
      lastFmRequest(apiKey, "artist.getTopTracks", { artist: seedArtist, limit: 12, autocorrect: 1 })
        .then((body) => (body?.toptracks?.track ?? []).map((track: any, index: number) =>
          toCandidate(track, "artist_top", seedArtist, 0.9 - index * 0.012)
        ).filter(Boolean)),
    )
  }

  if (seedArtist && seedTrack) {
    requests.push(
      lastFmRequest(apiKey, "track.getSimilar", {
        artist: seedArtist,
        track: seedTrack,
        limit: 15,
        autocorrect: 1,
      }).then((body) => (body?.similartracks?.track ?? []).map((track: any, index: number) => {
        const match = Number(track?.match)
        const score = Number.isFinite(match) ? 0.75 + match * 0.24 : 0.88 - index * 0.01
        return toCandidate(track, "similar_track", `${seedArtist} — ${seedTrack}`, score)
      }).filter(Boolean)),
    )
  }

  const settled = await Promise.allSettled(requests)
  const fulfilled = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
  if (fulfilled.length === 0) {
    const firstError = settled.find((result) => result.status === "rejected")
    throw firstError?.status === "rejected"
      ? firstError.reason
      : new Error("Last.fm no devolvió canciones para este perfil")
  }

  const unique = new Map<string, LastFmCandidate>()
  for (const candidate of fulfilled) {
    const previous = unique.get(candidate.provider_key)
    if (!previous || candidate.score > previous.score) unique.set(candidate.provider_key, candidate)
  }
  return [...unique.values()].sort((a, b) => b.score - a.score).slice(0, 35)
}
