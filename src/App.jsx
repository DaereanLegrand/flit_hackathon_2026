import { useState } from 'react'
import QRCode from 'qrcode'
import { supabase, supabaseUrl } from './supabase'
import './App.css'

export default function App() {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [hash, setHash] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    setQrDataUrl(null)
    setHash(null)
    try {
      const { data, error } = await supabase.functions.invoke('generate-qr', {
        method: 'POST',
      })

      if (error) throw error

      const url = `${supabaseUrl}/qr/${data.hash}`
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 })
      setQrDataUrl(dataUrl)
      setHash(data.hash)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="disco-home">
      <h1 className="disco-title" onClick={handleClick}>EMPEZAR</h1>
      {loading && <p className="disco-status">generando...</p>}
      {qrDataUrl && !loading && (
        <div className="qr-wrapper">
          <img src={qrDataUrl} alt="QR" className="qr-image" />
          {hash && <p className="qr-hash">{hash}</p>}
        </div>
      )}
    </div>
  )
}
