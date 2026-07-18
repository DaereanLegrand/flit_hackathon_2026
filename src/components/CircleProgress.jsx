export default function CircleProgress({ value, max = 100, size = 180 }) {
  const pct = Math.min((value / max) * 100, 100)

  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 326.73} 326.73`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-value">{value}%</span>
        <span className="gauge-label">ahorro</span>
      </div>
    </div>
  )
}
