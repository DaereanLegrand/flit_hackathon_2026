const STORAGE_KEY = "flit_song_votes";
export const VOTES_CHANGED_EVENT = "flit-votes-changed";

export function songKey(title, artist) {
  return `${title.toLowerCase()}|${artist.toLowerCase()}`;
}

export function getVotesMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveVotesMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function voteSong({ title, artist, coverUrl }) {
  const map = getVotesMap();
  const key = songKey(title, artist);
  const existing = map[key];

  map[key] = {
    title,
    artist,
    votes: (existing?.votes || 0) + 1,
    coverUrl: coverUrl || existing?.coverUrl || null,
  };

  saveVotesMap(map);
  window.dispatchEvent(new Event(VOTES_CHANGED_EVENT));
  return map[key];
}

export function buildRankedList(catalogSongs = []) {
  const votesMap = getVotesMap();
  const catalogByKey = new Map(
    catalogSongs.map((song) => [songKey(song.title, song.artist), song]),
  );
  const list = [];
  const seen = new Set();

  for (const entry of Object.values(votesMap)) {
    const key = songKey(entry.title, entry.artist);
    seen.add(key);
    const catalog = catalogByKey.get(key);

    list.push({
      id: key,
      title: entry.title,
      artist: entry.artist,
      coverUrl:
        entry.coverUrl ||
        catalog?.coverUrl ||
        "/placeholder-cover.png",
      vote_count: entry.votes,
    });
  }

  for (const song of catalogSongs) {
    const key = songKey(song.title, song.artist);
    if (seen.has(key)) continue;

    list.push({
      id: key,
      title: song.title,
      artist: song.artist,
      coverUrl: song.coverUrl || "/placeholder-cover.png",
      vote_count: 0,
    });
  }

  list.sort(
    (a, b) =>
      b.vote_count - a.vote_count ||
      a.title.localeCompare(b.title, "es"),
  );

  return list;
}
