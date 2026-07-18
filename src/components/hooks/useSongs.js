import { useState, useEffect } from "react";
import { searchRecording } from "../services/musicbrainz";
import { getCoverArt } from "../services/coverart";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useSongs(songList) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveSongs() {
      setLoading(true);
      const results = [];

      for (const song of songList) {
        try {
          const recording = await searchRecording(song.title, song.artist);
          const coverUrl = recording ? await getCoverArt(recording.releaseId) : null;

          results.push({
            title: song.title,
            artist: song.artist,
            coverUrl: coverUrl ?? "/placeholder-cover.png",
          });
        } catch (err) {
          results.push({
            title: song.title,
            artist: song.artist,
            coverUrl: "/placeholder-cover.png",
          });
        }

        // respeta el rate limit de MusicBrainz (1 req/seg)
        await delay(1000);
      }

      if (!cancelled) {
        setSongs(results);
        setLoading(false);
      }
    }

    resolveSongs().catch((err) => {
      if (!cancelled) {
        setError(err);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [songList]);

  return { songs, loading, error };
}