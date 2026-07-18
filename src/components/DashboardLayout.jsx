import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const navItems = [
  { path: '/resumen', label: 'Resumen', icon: '📊' },
  { path: '/transacciones', label: 'Transacciones', icon: '💳' },
  { path: '/mis-creditos', label: 'Mis Créditos', icon: '🏦' },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">💰 Finanzas</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'nav-item--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>v1.0.0</span>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
