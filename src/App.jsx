import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import Resumen from './components/Resumen'
import Transacciones from './components/Transacciones'
import MisCreditos from './components/MisCreditos'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/resumen" replace />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/transacciones" element={<Transacciones />} />
        <Route path="/mis-creditos" element={<MisCreditos />} />
      </Route>
    </Routes>
  )
}

export default App
