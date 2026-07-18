import { useState, useEffect, useCallback } from "react";
import {
  buildRankedList,
  voteSong,
  songKey,
  VOTES_CHANGED_EVENT,
} from "../services/songVotes";

export function useSongVotes(catalogSongs = []) {
  const [rankedSongs, setRankedSongs] = useState([]);
  const [votingKey, setVotingKey] = useState(null);

  const refresh = useCallback(() => {
    setRankedSongs(buildRankedList(catalogSongs));
  }, [catalogSongs]);

  useEffect(() => {
    refresh();

    window.addEventListener(VOTES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    const interval = setInterval(refresh, 2000);

    return () => {
      window.removeEventListener(VOTES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(interval);
    };
  }, [refresh]);

  function vote(song) {
    const key = songKey(song.title, song.artist);
    setVotingKey(key);
    voteSong({
      title: song.title,
      artist: song.artist,
      coverUrl: song.coverUrl,
    });
    refresh();
    setVotingKey(null);
  }

  return { rankedSongs, vote, votingKey };
}
