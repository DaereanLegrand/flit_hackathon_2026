import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import MiniMap from './MiniMap'
import useRoomSongs from './hooks/useRoomSongs'
import useAgentSession from './hooks/useAgentSession'
import MoodSlider from './MoodSlider'
import SongSearch from './SongSearch'

function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('device_id', id)
  }
  return id
}

export default function ScanPage() {
  const { hash } = useParams()
  const [nickname, setNickname] = useState('')
  const [phase, setPhase] = useState('form')
  const [quizStep, setQuizStep] = useState(1)
  const [moodValue, setMoodValue] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [participants, setParticipants] = useState([])
  const [error, setError] = useState('')
  const [location, setLocation] = useState(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const deviceId = useRef(getDeviceId())
  const intervalRef = useRef(null)

  const { songs: topSongs, addSong, votedKeys } = useRoomSongs(hash, deviceId.current)
  const { result: agentResult, loading: agentLoading, error: agentError, answer: agentAnswer, feedback: agentFeedback } = useAgentSession(moodValue)

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
      setPhase('quiz')
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
      const timer = setTimeout(() => setPhase('quiz'), 1500)
      return () => clearTimeout(timer)
    }
  }, [phase])

  function handleAnswer(value) {
    if (!value?.trim()) return
    agentAnswer(value.trim())
    setCustomAnswer('')
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

  if (phase === 'quiz') {
    if (quizStep === 1) {
      return (
        <MoodSlider onComplete={(val) => {
          setMoodValue(val)
          setQuizStep(2)
        }} />
      )
    }

    if (quizStep === 2) {
      return (
        <div className="mood-slider agent-quiz">
          <div className="daily-notes" aria-hidden="true">♪　♫　♬</div>

          <div className="mood-card agent-card">
            {agentLoading && (
              <div className="agent-loading">
                <span />
                <p>Buscando tu vibe...</p>
              </div>
            )}

            {!agentLoading && agentResult?.type === 'question' && (
              <>
                <p className="agent-progress">Pregunta {agentResult.progress.answered + 1}</p>
                <h1 className="mood-heading mood-heading--sm">{agentResult.question}</h1>
                <div className="agent-options">
                  {agentResult.options.map((option) => (
                    <button key={option} onClick={() => handleAnswer(option)}>{option}</button>
                  ))}
                </div>
                <form className="agent-custom" onSubmit={(event) => { event.preventDefault(); handleAnswer(customAnswer) }}>
                  <input
                    value={customAnswer}
                    onChange={(event) => setCustomAnswer(event.target.value)}
                    placeholder="Otra respuesta"
                    maxLength={600}
                  />
                  <button type="submit" disabled={!customAnswer.trim()}>Enviar</button>
                </form>
                <div className="mood-steps">
                  {Array.from({ length: 4 }, (_, index) => (
                    <span key={index} className={`mood-dot${index <= agentResult.progress.answered ? ' mood-dot--on' : ''}`} />
                  ))}
                </div>
              </>
            )}

            {!agentLoading && agentResult?.type === 'recommendation' && (
              <div className="agent-result">
                <p className="agent-progress">{agentResult.daily_vibe}</p>
                <h1 className="mood-heading mood-heading--sm">{agentResult.song.title}</h1>
                <h2>{agentResult.song.artist}</h2>
                <p>{agentResult.reason}</p>
                <div className="agent-listen">
                  <a href={agentResult.song.spotify_search_url} target="_blank" rel="noreferrer">Spotify</a>
                  <a href={agentResult.song.youtube_music_search_url} target="_blank" rel="noreferrer">YouTube Music</a>
                </div>
                <div className="agent-playlist">
                  {agentResult.playlist.map((track, index) => (
                    <a key={track.id} href={track.lastfm_url || track.youtube_music_search_url} target="_blank" rel="noreferrer">
                      <span>{index + 1}</span>
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                    </a>
                  ))}
                </div>
                <button className="mood-btn" onClick={() => setPhase('room')}>Ir a la sala</button>
              </div>
            )}

            {!agentLoading && agentError && (
              <div className="agent-error">
                <p>{agentError}</p>
                <button className="mood-btn" onClick={() => setPhase('room')}>Ir a la sala</button>
              </div>
            )}
          </div>
        </div>
      )
    }
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
          <SongSearch
            onAddSong={addSong}
            votedKeys={votedKeys}
            topSongs={topSongs}
          />
        )}

        {error && <p className="vote-error">{error}</p>}
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
