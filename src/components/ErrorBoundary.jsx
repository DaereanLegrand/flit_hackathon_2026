import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="disco-home">
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
            Algo salió mal
            <br />
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              style={{ marginTop: 16, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#000', background: 'var(--pink)', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 2 }}
            >
              Reintentar
            </button>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
