import { useState, useMemo } from 'react'
import { transactions as initialData, categories } from '../data/mockData'
import DonutChart from './DonutChart'

const DOT = ['#475b63', '#f2d88a', '#c7b7a6', '#5b9279', '#c96565', '#6a7a8a']

function fm(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

function fd(date) {
  return new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export default function Transacciones() {
  const [data, setData] = useState(initialData)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', category: 'Alimentación', type: 'expense' })
  const [filter, setFilter] = useState('all')

  const filtered = data.filter((t) => filter === 'all' || t.type === filter)

  const totalIn = data.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const totalOut = data.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

  const byCat = useMemo(() => {
    const map = {}
    data.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map).map(([c, v]) => ({ category: c, value: v }))
  }, [data])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    setData([{
      id: Date.now(),
      description: form.description,
      category: form.category,
      amount: parseFloat(form.amount),
      type: form.type,
      date: new Date().toISOString().slice(0, 10),
    }, ...data])
    setForm({ description: '', amount: '', category: 'Alimentación', type: 'expense' })
    setShowForm(false)
  }

  return (
    <div className="transacciones">
      <div className="tx-header">
        <h2 className="section-title">Transacciones</h2>
        <button className="btn btn--primary" onClick={() => setShowForm(true)}>+ Nueva</button>
      </div>

      <div className="tx-meta">
        <div className="tx-meta-block">
          <span className="tx-meta-label">Ingresos</span>
          <span className="tx-meta-val tx-meta-val--in">+{fm(totalIn)}</span>
          <span className="tx-meta-bar" style={{ width: `${(totalIn / (totalIn + totalOut)) * 100}%`, background: 'var(--primary)' }} />
        </div>
        <div className="tx-meta-block">
          <span className="tx-meta-label">Gastos</span>
          <span className="tx-meta-val tx-meta-val--out">-{fm(totalOut)}</span>
          <span className="tx-meta-bar" style={{ width: `${(totalOut / (totalIn + totalOut)) * 100}%`, background: 'var(--accent)' }} />
        </div>
      </div>

      <div className="tx-filters">
        {['all', 'income', 'expense'].map((f) => (
          <button key={f} className={`pill ${filter === f ? 'pill--on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todas' : f === 'income' ? 'Ingresos' : 'Gastos'}
          </button>
        ))}
      </div>

      {showForm && (
        <form className="tx-form" onSubmit={handleSubmit}>
          <input name="description" placeholder="Descripción" value={form.description} onChange={handleChange} required />
          <input name="amount" type="number" step="0.01" placeholder="Monto" value={form.amount} onChange={handleChange} required />
          <select name="category" value={form.category} onChange={handleChange}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
          <button className="btn btn--primary" type="submit">Guardar</button>
          <button className="btn btn--ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
        </form>
      )}

      <div className="tx-body">
        <div className="tx-list">
          {filtered.map((t, i) => (
            <div key={t.id} className="tx-row">
              <span className="tx-dot" style={{ background: DOT[i % DOT.length] }} />
              <div className="tx-row-body">
                <span className="tx-row-cat">{t.category}</span>
                <span className="tx-row-desc">{t.description}</span>
              </div>
              <span className="tx-row-date">{fd(t.date)}</span>
              <span className={`tx-row-val ${t.type === 'income' ? 'tx-row-val--in' : 'tx-row-val--out'}`}>
                {t.type === 'income' ? '+' : '-'}{fm(t.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="tx-chart-box">
          <span className="chart-title">Por categoría</span>
          <DonutChart data={byCat} total={totalOut} />
          <div className="legend">
            {byCat.map((item, i) => (
              <div key={item.category} className="legend-row">
                <span className="legend-dot" style={{ background: DOT[i % DOT.length] }} />
                <span className="legend-label">{item.category}</span>
                <span className="legend-val">{fm(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
