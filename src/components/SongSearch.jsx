import { useState, useRef } from 'react'
import { supabase } from '../supabase'

function formatTime(seconds) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SongSearch({ onAddSong, votedKeys, topSongs }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const searchTimer = useRef(null)
  const errorTimer = useRef(null)

  function handleSearchChange(value) {
    setQuery(value)
    clearTimeout(searchTimer.current)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await supabase.functions.invoke('search-songs', {
          method: 'POST',
          body: { q: value },
        })
        setResults(data?.results || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  async function handleAdd(result) {
    const title = result.title
    const artist = result.artist
    const coverUrl = result.cover?.small || result.cover?.large || null

    const { ok, error: addErr } = await onAddSong(title, artist, coverUrl)
    if (!ok) {
      setError(addErr)
      clearTimeout(errorTimer.current)
      errorTimer.current = setTimeout(() => setError(''), 2500)
      return
    }
    setQuery('')
    setResults([])
    setError('')
  }

  return (
    <>
      <div className="search-section">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar canción..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          autoFocus
        />
        {searching && <p className="search-status">buscando...</p>}
        <div className="search-results">
          {results.map((r) => {
            const key = `${r.title}|${r.artist}`
            const alreadyAdded = votedKeys.has(key)
            return (
              <div key={r.id} className="search-result">
                {r.cover && (
                  <img src={r.cover.small} alt="" className="result-cover" />
                )}
                <div className="result-info">
                  <span className="result-title">{r.title}</span>
                  <span className="result-artist">{r.artist}</span>
                </div>
                <span className="result-year">{r.year}</span>
                {r.length > 0 && (
                  <span className="result-duration">{formatTime(r.length / 1000)}</span>
                )}
                <button
                  type="button"
                  className="add-btn"
                  onClick={() => handleAdd(r)}
                  disabled={alreadyAdded}
                  aria-label={`Agregar ${r.title}`}
                >
                  {alreadyAdded ? '✓' : '+'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="vote-error">{error}</p>}

      {topSongs.length > 0 && (
        <div className="search-top-list">
          <p className="search-top-title">Top votadas</p>
          {topSongs.map((song, i) => {
            const key = `${song.title}|${song.artist}`
            const alreadyVoted = votedKeys.has(key)
            return (
              <div key={song.id} className="search-top-item">
                <span className="search-top-rank">{i + 1}</span>
                <img
                  src={song.coverUrl || '/placeholder-cover.png'}
                  alt=""
                  className="search-top-cover"
                />
                <div className="search-top-info">
                  <span className="search-top-song">{song.title}</span>
                  <span className="search-top-artist">{song.artist}</span>
                </div>
                <button
                  type="button"
                  className={`top-vote-btn${alreadyVoted ? ' top-vote-btn--active' : ''}`}
                  onClick={() => handleAdd({ title: song.title, artist: song.artist, cover: { small: song.coverUrl, large: song.coverUrl } })}
                  disabled={alreadyVoted}
                  aria-label={`Votar por ${song.title}`}
                >
                  <span className="top-vote-count">{song.vote_count}</span>
                  <span className="top-vote-heart">{alreadyVoted ? '♥' : '♡'}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
