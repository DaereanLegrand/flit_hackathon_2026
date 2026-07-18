const COLORS = ['#475b63', '#f2d88a', '#c7b7a6', '#5b9279', '#c96565', '#6a7a8a']

export default function DonutChart({ data, total, size = 180 }) {
  if (!data || data.length === 0) return null

  let accumulated = 0
  const stops = data.map((item, i) => {
    const pct = (item.value / total) * 100
    const start = accumulated
    accumulated += pct
    return `${COLORS[i % COLORS.length]} ${start}% ${accumulated}%`
  })

  const conic = `conic-gradient(${stops.join(', ')})`

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <div className="donut-ring" style={{ background: conic }}>
        <div className="donut-hole">
          <span className="donut-total">${total.toFixed(0)}</span>
          <span className="donut-label">gastos</span>
        </div>
      </div>
    </div>
  )
}
