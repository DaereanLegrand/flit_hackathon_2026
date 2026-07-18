export default function QuestionPlaceholder({ onComplete }) {
  return (
    <div className="mood-slider">
      <div className="mood-bg" style={{ background: 'radial-gradient(ellipse at 50% 35%, #ff2d7818 0%, transparent 70%)' }} />

      <div className="mood-card">
        <h1 className="mood-heading mood-heading--sm">Pregunta 2</h1>

        <p className="mood-placeholder-text">(próximamente)</p>

        <div className="mood-steps">
          <span className="mood-dot" />
          <span className="mood-dot mood-dot--on" />
          <span className="mood-dot" />
          <span className="mood-dot" />
        </div>

        <button className="mood-btn" onClick={onComplete}>
          Ir a la sala
        </button>
      </div>
    </div>
  )
}
