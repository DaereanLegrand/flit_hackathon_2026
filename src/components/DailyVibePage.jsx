import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
    return null
  } catch {
    return null
  }
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

export default function DailyVibePage() {
  const credentials = useRef(loadSession())
  const [result, setResult] = useState(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const [loading, setLoading] = useState(Boolean(credentials.current))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!credentials.current) return
    invokeAgent({ action: 'status', ...credentials.current })
      .then(setResult)
      .catch((err) => {
        setError(err.message)
        localStorage.removeItem(STORAGE_KEY)
        credentials.current = null
      })
      .finally(() => setLoading(false))
  }, [])

  async function run(body) {
    setLoading(true)
    setError('')
    try {
      const data = await invokeAgent(body)
      if (data.access_token) {
        credentials.current = {
          session_id: data.session_id,
          access_token: data.access_token,
          session_day: new Date().toISOString().slice(0, 10),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials.current))
      }
      setResult(data)
      setCustomAnswer('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function start() {
    run({ action: 'start', device_id: getDeviceId() })
  }

  function answer(value) {
    if (!value?.trim() || !credentials.current) return
    run({ action: 'answer', ...credentials.current, answer: value.trim() })
  }

  function feedback(value) {
    if (!credentials.current) return
    run({ action: 'feedback', ...credentials.current, feedback: value })
  }

  return (
    <main className="daily-vibe">
      <div className="daily-notes" aria-hidden="true">♪　♫　♬</div>
      <Link className="daily-back" to="/">← Vibe</Link>

      <section className="daily-card">
        <p className="daily-kicker">TU VIBE DE HOY</p>
        {!result && !loading && (
          <>
            <h1>¿Qué debería sonar ahora?</h1>
            <p className="daily-copy">Un test corto, una canción elegida para este momento y una playlist para continuar.</p>
            <button className="daily-primary" onClick={start}>COMENZAR</button>
          </>
        )}

        {loading && (
          <div className="daily-loading">
            <span />
            <p>El agente está pensando...</p>
          </div>
        )}

        {!loading && result?.type === 'question' && (
          <div className="daily-question">
            <p className="daily-progress">Pregunta {result.progress.answered + 1} · máximo {result.progress.maximum}</p>
            <h1>{result.question}</h1>
            <div className="daily-options">
              {result.options.map((option) => (
                <button key={option} onClick={() => answer(option)}>{option}</button>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); answer(customAnswer) }} className="daily-custom">
              <input
                value={customAnswer}
                onChange={(event) => setCustomAnswer(event.target.value)}
                placeholder="O escribe tu propia respuesta"
                maxLength={600}
              />
              <button disabled={!customAnswer.trim()} type="submit">ENVIAR</button>
            </form>
          </div>
        )}

        {!loading && result?.type === 'recommendation' && (
          <div className="daily-result">
            <p className="daily-progress">{result.daily_vibe}</p>
            <h1>{result.song.title}</h1>
            <h2>{result.song.artist}</h2>
            <p className="daily-copy">{result.reason}</p>
            <div className="daily-listen">
              <a href={result.song.spotify_search_url} target="_blank" rel="noreferrer">Buscar en Spotify</a>
              <a href={result.song.youtube_music_search_url} target="_blank" rel="noreferrer">Buscar en YouTube Music</a>
            </div>
            <div className="daily-playlist">
              <h3>Tu playlist</h3>
              {result.playlist.map((track, index) => (
                <a key={track.id} href={track.lastfm_url || track.youtube_music_search_url} target="_blank" rel="noreferrer">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </a>
              ))}
            </div>
            <div className="daily-feedback">
              <span>¿Acertó?</span>
              <button className={result.feedback === 'liked' ? 'selected' : ''} onClick={() => feedback('liked')}>Sí</button>
              <button className={result.feedback === 'disliked' ? 'selected' : ''} onClick={() => feedback('disliked')}>No</button>
            </div>
          </div>
        )}

        {error && <p className="daily-error">{error}</p>}
      </section>
    </main>
  )
}
