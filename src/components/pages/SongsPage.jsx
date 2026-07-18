import { initialSongs } from "../data/initialSongs";
import { useSongs } from "../hooks/useSongs";
import { useSongVotes } from "../hooks/useSongVotes";
import SongList from "../SongList";

export default function SongsPage() {
  const { songs: enriched, loading: loadingCovers, error } = useSongs(initialSongs);
  const { rankedSongs, vote, votingKey } = useSongVotes(enriched);

  if (loadingCovers) {
    return (
      <div className="songs-page">
        <p className="songs-page-status">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="songs-page">
        <p className="songs-page-error">Error al cargar canciones</p>
      </div>
    );
  }

  return (
    <div className="songs-page">
      <h1 className="songs-page-title">Top canciones</h1>
      <p className="songs-page-sub">Vota y mira el ranking en vivo</p>
      <SongList songs={rankedSongs} onVote={vote} votingKey={votingKey} />
    </div>
  );
}
