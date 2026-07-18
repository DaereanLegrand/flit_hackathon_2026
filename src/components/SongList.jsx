import SongCard from "./SongCard";

export default function SongList({ songs, onVote, votingKey }) {
  return (
    <div className="song-list">
      {songs.map((song, i) => {
        const key = song.id ?? `${song.title}-${song.artist}`;
        return (
          <SongCard
            key={key}
            rank={i + 1}
            {...song}
            onVote={() => onVote(song)}
            voting={votingKey === key}
          />
        );
      })}
    </div>
  );
}
