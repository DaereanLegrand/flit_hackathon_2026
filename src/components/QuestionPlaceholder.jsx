import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

const STORAGE_KEY = 'vibe_daily_session'

function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('device_id', id)
  }
  return id
}

function loadSession() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const todayUtc = new Date().toISOString().slice(0, 10)
    if (value?.session_id && value?.access_token && value?.session_day === todayUtc) return value
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return null
}

async function invokeAgent(body) {
  const { data, error } = await supabase.functions.invoke('daily-dj-agent', { body })
  if (error) {
    const contextBody = await error.context?.json?.().catch(() => null)
    throw new Error(data?.error || contextBody?.error || error.message || 'No se pudo contactar al agente')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export default function QuestionPlaceholder({ initialMood, onComplete }) {
  const credentials = useRef(loadSession())
  const [result, setResult] = useState(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const request = credentials.current
      ? { action: 'status', ...credentials.current }
      : { action: 'start', device_id: getDeviceId(), initial_mood: initialMood }

    invokeAgent(request)
      .then((data) => {
        if (data.access_token) {
          credentials.current = {
            session_id: data.session_id,
            access_token: data.access_token,
            session_day: new Date().toISOString().slice(0, 10),
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials.current))
        }
        setResult(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [initialMood])

  async function run(body) {
    setLoading(true)
    setError('')
    try {
      const data = await invokeAgent(body)
      setResult(data)
      setCustomAnswer('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function answer(value) {
    if (!credentials.current || !value?.trim()) return
    run({ action: 'answer', ...credentials.current, answer: value.trim() })
  }

  return (
    <div className="mood-slider agent-quiz">
      <div className="mood-bg" style={{ background: 'radial-gradient(ellipse at 50% 35%, #ff2d7818 0%, transparent 70%)' }} />

      <div className="mood-card agent-card">
        {loading && (
          <div className="agent-loading">
            <span />
            <p>Buscando tu vibe...</p>
          </div>
        )}

        {!loading && result?.type === 'question' && (
          <>
            <p className="agent-progress">Pregunta {result.progress.answered + 1}</p>
            <h1 className="mood-heading mood-heading--sm">{result.question}</h1>
            <div className="agent-options">
              {result.options.map((option) => (
                <button key={option} onClick={() => answer(option)}>{option}</button>
              ))}
            </div>
            <form className="agent-custom" onSubmit={(event) => { event.preventDefault(); answer(customAnswer) }}>
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
                <span key={index} className={`mood-dot${index <= result.progress.answered ? ' mood-dot--on' : ''}`} />
              ))}
            </div>
          </>
        )}

        {!loading && result?.type === 'recommendation' && (
          <div className="agent-result">
            <p className="agent-progress">{result.daily_vibe}</p>
            <h1 className="mood-heading mood-heading--sm">{result.song.title}</h1>
            <h2>{result.song.artist}</h2>
            <p>{result.reason}</p>
            <div className="agent-listen">
              <a href={result.song.spotify_search_url} target="_blank" rel="noreferrer">Spotify</a>
              <a href={result.song.youtube_music_search_url} target="_blank" rel="noreferrer">YouTube Music</a>
            </div>
            <div className="agent-playlist">
              {result.playlist.map((track, index) => (
                <a key={track.id} href={track.lastfm_url || track.youtube_music_search_url} target="_blank" rel="noreferrer">
                  <span>{index + 1}</span>
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </a>
              ))}
            </div>
            <button className="mood-btn" onClick={onComplete}>Ir a la sala</button>
          </div>
        )}

        {!loading && error && (
          <div className="agent-error">
            <p>{error}</p>
            <button className="mood-btn" onClick={onComplete}>Ir a la sala</button>
          </div>
        )}
      </div>
    </div>
  )
}
