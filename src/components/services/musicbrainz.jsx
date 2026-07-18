const BASE_URL = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TuApp/1.0 (tuemail@ejemplo.com)";

export async function searchRecording(title, artist) {
  const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
  const res = await fetch(`${BASE_URL}/recording/?query=${query}&fmt=json&limit=1`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) throw new Error("Error buscando en MusicBrainz");

  const data = await res.json();
  const recording = data.recordings?.[0];
  if (!recording) return null;

  const releaseId = recording.releases?.[0]?.id ?? null;

  return {
    recordingId: recording.id,
    title: recording.title,
    artist: recording["artist-credit"]?.[0]?.name ?? artist,
    releaseId,
  };
}