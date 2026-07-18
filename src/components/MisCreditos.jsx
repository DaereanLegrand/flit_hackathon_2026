import { useState, useMemo } from 'react'
import { credits } from '../data/mockData'

function fm(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function monthlyPayment(balance, apr, months) {
  if (months <= 0 || balance <= 0) return 0
  const r = apr / 100 / 12
  if (r === 0) return balance / months
  return balance * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function CreditCard({ credit }) {
  const [extra, setExtra] = useState(0)
  const paidPct = ((1 - credit.remainingBalance / credit.totalAmount) * 100)

  const currentPayment = useMemo(
    () => monthlyPayment(credit.remainingBalance, credit.apr, credit.remainingMonths),
    [credit.remainingBalance, credit.apr, credit.remainingMonths]
  )

  const totalCurrently = currentPayment * credit.remainingMonths
  const interestCurrently = totalCurrently - credit.remainingBalance

  const results = useMemo(() => {
    const e = parseFloat(extra) || 0
    if (e <= 0) return { saved: 0, newMonths: credit.remainingMonths, newTotal: totalCurrently, newInterest: interestCurrently }

    const newBalance = Math.max(0, credit.remainingBalance - e)
    if (newBalance <= 0) {
      return { saved: interestCurrently, newMonths: 0, newTotal: 0, newInterest: 0 }
    }

    const r = credit.apr / 100 / 12
    const P = currentPayment
    const n = Math.log(P / (P - newBalance * r)) / Math.log(1 + r)
    const newMonths = Math.ceil(n)
    const newTotal = P * newMonths
    const newInterest = newTotal - newBalance
    return {
      saved: Math.max(0, totalCurrently - newTotal),
      newMonths,
      newTotal,
      newInterest,
    }
  }, [extra, credit.remainingBalance, credit.apr, credit.remainingMonths, currentPayment, totalCurrently, interestCurrently])

  return (
    <div className="credit-card">
      <div className="credit-head">
        <div className="credit-head-left">
          <span className="credit-name">{credit.name}</span>
          <span className="credit-lender">{credit.lender}</span>
        </div>
        <span className="credit-apr">{credit.apr}% APR</span>
      </div>

      <div className="credit-progress">
        <div className="credit-progress-track">
          <div className="credit-progress-fill" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="credit-progress-labels">
          <span>Pagado: {fm(credit.totalAmount - credit.remainingBalance)}</span>
          <span>Restante: {fm(credit.remainingBalance)}</span>
        </div>
      </div>

      <div className="credit-stats">
        <div className="credit-stat">
          <span className="credit-stat-label">Pago mensual</span>
          <span className="credit-stat-val">{fm(currentPayment)}</span>
        </div>
        <div className="credit-stat">
          <span className="credit-stat-label">Plazo restante</span>
          <span className="credit-stat-val">{credit.remainingMonths} meses</span>
        </div>
        <div className="credit-stat">
          <span className="credit-stat-label">Próximo pago</span>
          <span className="credit-stat-val">
            {new Date(credit.nextPaymentDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      <div className="credit-breakdown">
        <div className="credit-bar-section">
          <span className="credit-bar-label" style={{ color: 'var(--primary)' }}>
            Capital {fm(credit.remainingBalance)}
          </span>
          <div className="credit-bar-total">
            <div className="credit-bar-seg" style={{ flex: credit.remainingBalance, background: 'var(--primary)' }} />
            <div className="credit-bar-seg" style={{ flex: interestCurrently, background: 'var(--accent)' }} />
          </div>
          <span className="credit-bar-label" style={{ color: 'var(--text-secondary)' }}>
            Intereses {fm(interestCurrently)}
          </span>
        </div>
      </div>

      <div className="credit-early">
        <span className="credit-early-title">Pago anticipado</span>
        <div className="credit-early-row">
          <input
            type="range"
            min={0}
            max={credit.remainingBalance}
            step={500}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
          <input
            type="number"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="credit-early-input"
          />
        </div>
        <div className="credit-savings-row">
          <div className="credit-savings-block">
            <span className="credit-savings-label">Nuevo plazo</span>
            <span className="credit-savings-val">{results.newMonths} meses</span>
          </div>
          <div className="credit-savings-block credit-savings-block--highlight">
            <span className="credit-savings-label">Ahorro en intereses</span>
            <span className="credit-savings-val">{fm(results.saved)}</span>
          </div>
        </div>
        {results.saved > 0 && (
          <div className="credit-savings-bar">
            <div className="credit-savings-bar-fill" style={{ width: `${Math.min((results.saved / interestCurrently) * 100, 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function MisCreditos() {
  const totalDebt = credits.reduce((a, c) => a + c.remainingBalance, 0)
  const totalInterest = credits.reduce((a, c) => {
    const p = monthlyPayment(c.remainingBalance, c.apr, c.remainingMonths)
    return a + (p * c.remainingMonths - c.remainingBalance)
  }, 0)

  return (
    <div className="mis-creditos">
      <h2 className="section-title">Mis Créditos</h2>

      <div className="debt-summary">
        <div className="debt-card">
          <span className="debt-label">Deuda total</span>
          <span className="debt-val">{fm(totalDebt)}</span>
        </div>
        <div className="debt-card">
          <span className="debt-label">Intereses por pagar</span>
          <span className="debt-val debt-val--accent">{fm(totalInterest)}</span>
        </div>
        <div className="debt-card">
          <span className="debt-label">Créditos activos</span>
          <span className="debt-val">{credits.length}</span>
        </div>
      </div>

      <div className="credits-list">
        {credits.map((credit) => (
          <CreditCard key={credit.id} credit={credit} />
        ))}
      </div>
    </div>
  )
}
