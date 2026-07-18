export default function SongCard({
  title,
  artist,
  coverUrl,
  vote_count = 0,
  rank,
  onVote,
  voting,
}) {
  return (
    <div className={`song-card${vote_count > 0 ? " song-card--voted" : ""}`}>
      <span className="song-rank">{rank}</span>
      <img
        src={coverUrl || "/placeholder-cover.png"}
        alt={`Portada de ${title}`}
        className="song-card-img"
      />
      <div className="song-card-body">
        <h3 className="song-card-title">{title}</h3>
        <p className="song-card-artist">{artist}</p>
      </div>
      <button
        type="button"
        className="vote-btn"
        onClick={onVote}
        disabled={voting}
        aria-label={`Votar por ${title}`}
      >
        <span className="vote-btn-icon">▲</span>
        <span className="vote-btn-count">{vote_count}</span>
      </button>
    </div>
  );
}
