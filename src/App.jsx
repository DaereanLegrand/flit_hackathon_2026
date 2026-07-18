import { Routes, Route, Navigate } from 'react-router-dom'
import HostPage from './components/HostPage'
import ScanPage from './components/ScanPage'
import SongsPage from "./components/pages/SongsPage";
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HostPage />} />
      <Route path="/qr/:hash" element={<ScanPage />} />
      <Route path="/songs" element={<SongsPage />} />
      <Route path="/daily-vibe" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
