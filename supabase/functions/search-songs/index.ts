import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

const MUSICBRAINZ = "https://musicbrainz.org/ws/2"
const COVER_ART = "https://coverartarchive.org/release"
const USER_AGENT = "FlitDisco/1.0 (hackathon)"

interface Release {
  id: string
  title: string
  "release-group"?: { id: string; title: string }
  date?: string
  country?: string
}

interface RecordingResult {
  id: string
  title: string
  length?: number
  "artist-credit"?: { name: string; artist: { id: string; name: string } }[]
  releases?: Release[]
  cover?: { small: string; large: string } | null
  artist: string
  year: string
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req) => {
    try {
      const { q } = await req.json()
      if (!q || q.trim().length < 2) {
        return Response.json({ error: "Query too short" }, { status: 400 })
      }

      const searchUrl = `${MUSICBRAINZ}/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=10`
      const mbRes = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } })
      if (!mbRes.ok) {
        return Response.json({ error: "MusicBrainz search failed" }, { status: 502 })
      }

      const mbData = await mbRes.json()
      const recordings: RecordingResult[] = (mbData.recordings || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        length: r.length,
        artist: r["artist-credit"]?.[0]?.name || "Unknown",
        year: r["first-release-date"]?.slice(0, 4) || "",
        releases: (r.releases || []).slice(0, 3),
        cover: null,
      }))

      const results = await Promise.all(
        recordings.map(async (rec) => {
          const releaseId = rec.releases?.[0]?.id
          if (releaseId) {
            try {
              const caRes = await fetch(
                `${COVER_ART}/${releaseId}/`,
                { headers: { "User-Agent": USER_AGENT } },
              )
              if (caRes.ok) {
                const caData = await caRes.json()
                const front = caData.images?.find((img: any) => img.front)
                if (front) {
                  rec.cover = {
                    small: front.thumbnails?.small || front.image,
                    large: front.thumbnails?.large || front.image,
                  }
                }
              }
            } catch {}
          }
          return rec
        }),
      )

      return Response.json({ results })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }),
}
