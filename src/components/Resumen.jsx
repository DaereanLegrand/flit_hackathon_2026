import { summary, transactions } from '../data/mockData'
import CircleProgress from './CircleProgress'

function fm(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function dailyTotals() {
  const map = {}
  transactions.forEach((t) => {
    const d = t.date
    map[d] = map[d] || 0
    if (t.type === 'expense') map[d] += t.amount
  })
  return Object.values(map)
}

export default function Resumen() {
  const barData = dailyTotals()
  const maxVal = Math.max(...barData, 1)

  return (
    <div className="resumen">
      <div className="top-row">
        <div className="hero-card">
          <CircleProgress value={summary.savingsRate} />
          <div className="hero-info">
            <span className="hero-label">Balance Total</span>
            <span className="hero-amount">{fm(summary.totalBalance)}</span>
            <span className="hero-sub">+{fm(summary.monthlyIncome - summary.monthlyExpenses)} este mes</span>
          </div>
        </div>

        <div className="hero-card hero-card--row">
          <div className="hero-mini">
            <span className="hero-mini-bar hero-mini-bar--in" style={{ width: '85%' }} />
            <span className="hero-mini-label">Ingresos</span>
            <span className="hero-mini-value">{fm(summary.monthlyIncome)}</span>
          </div>
          <div className="hero-mini">
            <span className="hero-mini-bar hero-mini-bar--out" style={{ width: '60%' }} />
            <span className="hero-mini-label">Gastos</span>
            <span className="hero-mini-value">{fm(summary.monthlyExpenses)}</span>
          </div>
          <div className="hero-mini">
            <span className="hero-mini-bar" style={{ width: '40%', background: 'var(--accent)' }} />
            <span className="hero-mini-label">Disponible</span>
            <span className="hero-mini-value">{fm(summary.monthlyIncome - summary.monthlyExpenses)}</span>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <span className="chart-title">Gastos diarios</span>
        <div className="bar-chart">
          {DAYS.map((day, i) => {
            const val = barData[i] || 0
            const h = (val / maxVal) * 100
            return (
              <div key={day} className="bar-col">
                <span className="bar-val">${val.toFixed(0)}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${h}%` }} />
                </div>
                <span className="bar-label">{day}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
