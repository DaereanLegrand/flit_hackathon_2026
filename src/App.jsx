import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import Resumen from './components/Resumen'
import Transacciones from './components/Transacciones'
import MisCreditos from './components/MisCreditos'
import { Login } from './components/LogIn'
import PrivateRoute from './components/session/PrivateRoute'
import './App.css'

function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<Login />} />

      {/* Rutas protegidas */}
      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Navigate to="/resumen" replace />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/transacciones" element={<Transacciones />} />
        <Route path="/mis-creditos" element={<MisCreditos />} />
      </Route>

      {/* Cualquier ruta no encontrada */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App