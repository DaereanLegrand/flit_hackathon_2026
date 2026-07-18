import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import { supabase, supabaseUrl } from '../supabase'
import LocationPicker from './LocationPicker'
import MiniMap from './MiniMap'

export default function HostPage() {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [hash, setHash] = useState(null)
  const [loading, setLoading] = useState(false)
  const [participants, setParticipants] = useState([])
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [location, setLocation] = useState(null)
  const intervalRef = useRef(null)

  const getRoom = useCallback(async (h) => {
    try {
      const { data } = await supabase.functions.invoke('get-room', {
        method: 'POST',
        body: { qr_hash: h },
      })
      if (data?.participants) setParticipants(data.participants)
    } catch {}
  }, [])

  useEffect(() => {
    if (hash) {
      getRoom(hash)
      intervalRef.current = setInterval(() => getRoom(hash), 2000)
      return () => clearInterval(intervalRef.current)
    }
  }, [hash, getRoom])

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-qr', {
        method: 'POST',
      })
      if (error) throw error

      const url = `${window.location.origin}/qr/${data.hash}`
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2, color: { light: '#ffffff' } })
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
      {!qrDataUrl && (
        <h1 className="disco-title" onClick={handleClick}>EMPEZAR</h1>
      )}
      {loading && <p className="disco-status">generando...</p>}
      {qrDataUrl && (
        <>
          <div className="qr-wrapper">
            <img src={qrDataUrl} alt="QR" className="qr-image" />
          </div>
          <div className="room-section">
            <p className="room-count">{participants.length} en la sala</p>
            <div className="room-list">
              {participants.map((p) => (
                <div key={p.id} className="room-participant">{p.nickname}</div>
              ))}
            </div>
          </div>
          {!location && (
            <button
              className="add-song-btn"
              onClick={() => setShowLocationPicker(true)}
            >
              QUEDAR<br />LUGAR
            </button>
          )}

          {location && (
            <div className="location-card">
              <MiniMap lat={location.lat} lng={location.lng} />
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
              >
                Compartir ubicacion
              </a>
            </div>
          )}
        </>
      )}
      {showLocationPicker && hash && (
        <LocationPicker
          hash={hash}
          onClose={() => { setShowLocationPicker(false); setHasLocation(true) }}
        />
      )}
    </div>
  )
}
