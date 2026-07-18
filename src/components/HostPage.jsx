import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../supabase'
import LocationPicker from './LocationPicker'
import MiniMap from './MiniMap'
import useRoomSongs from './hooks/useRoomSongs'

function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('device_id', id)
  }
  return id
}

export default function HostPage() {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [hash, setHash] = useState(null)
  const [loading, setLoading] = useState(false)
  const [participants, setParticipants] = useState([])
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [location, setLocation] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)
  const searchTimer = useRef(null)
  const errorTimer = useRef(null)

  const deviceId = useRef(getDeviceId())
  const { songs: topSongs, addSong, votedKeys } = useRoomSongs(hash, deviceId.current)

  const getRoom = useCallback(async (h) => {
    try {
      const { data } = await supabase.functions.invoke('get-room', {
        method: 'POST',
        body: { qr_hash: h },
      })
      if (data?.participants) setParticipants(data.participants)
    } catch {}
  }, [])

  useEffect(() => {
    if (hash) {
      getRoom(hash)
      intervalRef.current = setInterval(() => getRoom(hash), 2000)
      return () => clearInterval(intervalRef.current)
    }
  }, [hash, getRoom])

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-qr', {
        method: 'POST',
      })
      if (error) throw error

      const url = `${window.location.origin}/qr/${data.hash}`
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2, color: { light: '#ffffff' } })
      setQrDataUrl(dataUrl)
      setHash(data.hash)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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

  async function handleAddSong(result) {
    const title = result.title
    const artist = result.artist
    const coverUrl = result.cover?.small || result.cover?.large || null

    const { ok, error: addErr } = await addSong(title, artist, coverUrl)
    if (!ok) {
      setError(addErr)
      clearTimeout(errorTimer.current)
      errorTimer.current = setTimeout(() => setError(''), 2500)
      return
    }
    setShowSearch(false)
    setQuery('')
    setResults([])
    setError('')
  }

  return (
    <div className="disco-home">
      {!qrDataUrl && (
        <h1 className="disco-title" onClick={handleClick}>EMPEZAR</h1>
      )}
      {loading && <p className="disco-status">generando...</p>}
      {qrDataUrl && (
        <>
          <div className="qr-wrapper">
            <img src={qrDataUrl} alt="QR" className="qr-image" />
          </div>
          <div className="room-section">
            <p className="room-count">{participants.length} en la sala</p>
            <div className="room-list">
              {participants.map((p) => (
                <div key={p.id} className="room-participant">{p.nickname}</div>
              ))}
            </div>
          </div>

          <div className="host-actions">
            {!showSearch && (
              <button className="add-song-btn" onClick={() => setShowSearch(true)}>Agregar cancion</button>
            )}

            {!location && (
              <button
                className="add-song-btn add-song-btn--set"
                onClick={() => setShowLocationPicker(true)}
              >
                QUEDAR<br />LUGAR
              </button>
            )}
          </div>

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
                        onClick={() => handleAddSong(r)}
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
          )}

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
                      onClick={() => handleAddSong({ title: song.title, artist: song.artist, cover: { small: song.coverUrl, large: song.coverUrl } })}
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

          {location && (
            <div className="location-card">
              <MiniMap lat={location.lat} lng={location.lng} />
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
              >
                Compartir ubicacion
              </a>
            </div>
          )}
        </>
      )}
      {showLocationPicker && hash && (
        <LocationPicker
          hash={hash}
          onClose={(loc) => { setShowLocationPicker(false); if (loc) setLocation(loc) }}
        />
      )}
    </div>
  )
}
