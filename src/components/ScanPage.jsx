import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import MiniMap from './MiniMap'
import {
  voteSong,
  songKey,
  getVotesMap,
  buildRankedList,
  VOTES_CHANGED_EVENT,
} from './services/songVotes'

function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('device_id', id)
  }
  return id
}

export default function ScanPage() {
  const { hash } = useParams()
  const [nickname, setNickname] = useState('')
  const [phase, setPhase] = useState('form') // form → joining → room
  const [showSearch, setShowSearch] = useState(false)
  const [participants, setParticipants] = useState([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [votesMap, setVotesMap] = useState({})
  const [topSongs, setTopSongs] = useState([])
  const [location, setLocation] = useState(null)
  const deviceId = useRef(getDeviceId())
  const intervalRef = useRef(null)
  const searchTimer = useRef(null)

  const savedNickname = localStorage.getItem(`room_${hash}`)

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('get-room', {
        method: 'POST',
        body: { qr_hash: hash },
      })
      if (data?.participants) setParticipants(data.participants)
    } catch {}
  }, [hash])

  useEffect(() => {
    if (savedNickname) {
      setNickname(savedNickname)
      setPhase('room')
    }
  }, [savedNickname])

  useEffect(() => {
    if (phase === 'room') {
      fetchRoom()
      intervalRef.current = setInterval(fetchRoom, 2000)
      return () => clearInterval(intervalRef.current)
    }
  }, [phase, fetchRoom])

  useEffect(() => {
    if (phase === 'room') {
      supabase.functions.invoke('get-location', {
        method: 'POST',
        body: { hash },
      }).then(({ data }) => {
        if (data?.lat && data?.lng) setLocation(data)
      }).catch(() => {})
    }
  }, [phase, hash])

  useEffect(() => {
    if (phase === 'joining') {
      const timer = setTimeout(() => setPhase('room'), 1500)
      return () => clearTimeout(timer)
    }
  }, [phase])

  const refreshVotes = useCallback(() => {
    setVotesMap(getVotesMap())
    setTopSongs(buildRankedList([]).filter((s) => s.vote_count > 0))
  }, [])

  useEffect(() => {
    refreshVotes()
    window.addEventListener(VOTES_CHANGED_EVENT, refreshVotes)
    window.addEventListener('storage', refreshVotes)
    return () => {
      window.removeEventListener(VOTES_CHANGED_EVENT, refreshVotes)
      window.removeEventListener('storage', refreshVotes)
    }
  }, [refreshVotes])

  function handleVoteResult(result) {
    voteSong({
      title: result.title,
      artist: result.artist,
      coverUrl: result.cover?.small || result.cover?.large || null,
    })
    refreshVotes()
  }

  function getVoteCount(title, artist) {
    return votesMap[songKey(title, artist)]?.votes || 0
  }

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

  function formatTime(seconds) {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!nickname.trim()) return
    setError('')
    try {
      const { error: err } = await supabase.functions.invoke('join-room', {
        method: 'POST',
        body: { qr_hash: hash, device_id: deviceId.current, nickname: nickname.trim() },
      })
      if (err) throw err
      localStorage.setItem(`room_${hash}`, nickname.trim())
      setPhase('joining')
    } catch (err) {
      setError(err.message || 'Error al unirse')
    }
  }

  if (phase === 'joining') {
    return (
      <div className="disco-home">
        <div className="joined-badge">✓</div>
      </div>
    )
  }

  if (phase === 'room') {
    return (
      <div className="disco-home">
        <div className="room-top">
          <p className="joined-nick">{nickname}</p>
          <p className="room-count">{participants.length} en la sala</p>
          <div className="room-list">
            {participants.map((p) => (
              <div key={p.id} className="room-participant">
                {p.nickname}{p.device_id === deviceId.current ? ' (tú)' : ''}
              </div>
            ))}
          </div>
        </div>

        {location && (
            <div className="location-card">
              <MiniMap lat={location.lat} lng={location.lng} />
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
              >
                Como llegar
              </a>
            </div>
          )}

        {!showSearch && (
          <button className="add-song-btn" onClick={() => setShowSearch(true)}>Agregar cancion</button>
        )}

        {showSearch && (
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
              {results.map((r) => (
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
                    className="vote-btn vote-btn--compact"
                    onClick={() => handleVoteResult(r)}
                    aria-label={`Votar por ${r.title}`}
                  >
                    <span className="vote-btn-icon">♥</span>
                    <span className="vote-btn-count">{getVoteCount(r.title, r.artist)}</span>
                  </button>
                </div>
              ))}
            </div>

            {topSongs.length > 0 && (
              <div className="search-top-list">
                <p className="search-top-title">Top votadas</p>
                {topSongs.map((song, i) => (
                  <div key={song.id} className="search-top-item">
                    <span className="search-top-rank">{i + 1}</span>
                    <img
                      src={song.coverUrl}
                      alt=""
                      className="search-top-cover"
                    />
                    <div className="search-top-info">
                      <span className="search-top-song">{song.title}</span>
                      <span className="search-top-artist">{song.artist}</span>
                    </div>
                    <span className="search-top-votes">{song.vote_count} ♥</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="disco-home">
      <p className="scan-title">Entra a la sala</p>
      <form className="nickname-form" onSubmit={handleJoin}>
        <input
          className="nickname-input"
          type="text"
          placeholder="Tu nombre"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button className="nickname-btn" type="submit">Entrar</button>
      </form>
      {error && <p className="scan-error">{error}</p>}
    </div>
  )
}
