import { useState, useRef, useCallback } from 'react'

const COLORS = [
  '#1565C0', '#1976D2', '#5C6BC0', '#7c4dff', '#AB47BC',
  '#ff2d78', '#FF7043', '#FF8A65', '#FFB74D', '#FFD54F', '#FFD700',
]

const TEXT_LABELS = ['terrible', 'mal', 'regular', 'bien', 'muy bien', 'increíble']

function getEmoji(v) {
  if (v <= 1) return '😢'
  if (v <= 3) return '😔'
  if (v <= 5) return '😐'
  if (v <= 7) return '🙂'
  if (v <= 9) return '😊'
  return '😄'
}

function getLabelIndex(v) {
  if (v <= 1) return 0
  if (v <= 3) return 1
  if (v <= 5) return 2
  if (v <= 7) return 3
  if (v <= 9) return 4
  return 5
}

export default function MoodSlider({ onComplete }) {
  const [value, setValue] = useState(5)
  const [bounceKey, setBounceKey] = useState(0)
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef(null)
  const accent = COLORS[value]
  const labelIndex = getLabelIndex(value)
  const pct = (value / 10) * 100

  const setFromEvent = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const v = Math.round((x / rect.width) * 10)
    if (v !== value) setBounceKey((k) => k + 1)
    setValue(v)
  }, [value])

  function handlePointerDown(e) {
    e.preventDefault()
    setDragging(true)
    setFromEvent(e.clientX)
  }

  function handlePointerMove(e) {
    if (!dragging) return
    setFromEvent(e.clientX)
  }

  function handlePointerUp() {
    setDragging(false)
  }

  return (
    <div
      className={`mood-slider${dragging ? ' mood-slider--dragging' : ''}`}
      style={{ '--accent': accent }}
    >
      <div className="mood-bg" style={{ backgroundColor: `${accent}18` }} />

      <div className="mood-card">
        <h1 className="mood-heading">¿Cómo te sientes hoy?</h1>

        <div className="mood-track-area">
          <div
            ref={trackRef}
            className="mood-track"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ touchAction: 'none' }}
          >
            <div className="mood-track-bg" />
            <div className="mood-thumb" style={{ left: `${pct}%`, background: accent }} />
          </div>
        </div>

        <div className="mood-labels-row">
          {TEXT_LABELS.map((label, i) => (
            <span key={label} className={`mood-label${i === labelIndex ? ' mood-label--on' : ''}`}>
              {label}
            </span>
          ))}
        </div>

        <div key={bounceKey} className="mood-current-emoji">
          {getEmoji(value)}
        </div>

        <div className="mood-steps">
          <span className="mood-dot mood-dot--on" />
          <span className="mood-dot" />
          <span className="mood-dot" />
          <span className="mood-dot" />
        </div>

        <button className="mood-btn" onClick={() => onComplete(value)}>
          Continuar
        </button>
      </div>
    </div>
  )
}
