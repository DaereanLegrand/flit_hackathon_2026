import { Routes, Route } from 'react-router-dom'
import HostPage from './components/HostPage'
import ScanPage from './components/ScanPage'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HostPage />} />
      <Route path="/qr/:hash" element={<ScanPage />} />
    </Routes>
  )
}
