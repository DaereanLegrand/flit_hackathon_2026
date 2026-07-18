
import SongCard from "./SongCard";  // ✅ sin llaves

export default function SongList({ songs }) {
  return (
    <div className="song-list">
      {songs.map((song, i) => (
        <SongCard key={i} {...song} />
      ))}
    </div>
  );
}