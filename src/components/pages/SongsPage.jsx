import { initialSongs } from "../data/initialSongs";
import { useSongs } from "../hooks/useSongs";
import SongList from "../SongList";

export default function SongsPage() {
  const { songs, loading, error } = useSongs(initialSongs);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>Error al cargar canciones</p>;

  return <SongList songs={songs} />;
}