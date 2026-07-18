export default function SongCard({ title, artist, coverUrl }) {
  return (
    <div className="song-card">
      <img
        src={coverUrl || "/placeholder-cover.png"}
        alt={`Portada de ${title}`}
        className="song-card-img"
      />
      <h3 className="song-card-title">{title}</h3>
      <p className="song-card-artist">{artist}</p>
    </div>
  );
}