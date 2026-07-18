import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'

function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('device_id', id)
  }
  return id
}

export default function ScanPage() {
  const { hash } = useParams()
  const [nickname, setNickname] = useState('')
  const [joined, setJoined] = useState(false)
  const [participants, setParticipants] = useState([])
  const [error, setError] = useState('')
  const deviceId = useRef(getDeviceId())
  const intervalRef = useRef(null)

  const savedNickname = localStorage.getItem(`room_${hash}`)

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('get-room', {
        method: 'POST',
        body: { qr_hash: hash },
      })
      if (data?.participants) setParticipants(data.participants)
    } catch {}
  }, [hash])

  useEffect(() => {
    if (savedNickname) {
      setJoined(true)
    }
  }, [savedNickname])

  useEffect(() => {
    if (joined) {
      fetchRoom()
      intervalRef.current = setInterval(fetchRoom, 2000)
      return () => clearInterval(intervalRef.current)
    }
  }, [joined, fetchRoom])

  async function handleJoin(e) {
    e.preventDefault()
    if (!nickname.trim()) return
    setError('')
    try {
      const { error: err } = await supabase.functions.invoke('join-room', {
        method: 'POST',
        body: { qr_hash: hash, device_id: deviceId.current, nickname: nickname.trim() },
      })
      if (err) throw err
      localStorage.setItem(`room_${hash}`, nickname.trim())
      setJoined(true)
    } catch (err) {
      setError(err.message || 'Error al unirse')
    }
  }

  if (joined) {
    return (
      <div className="disco-home">
        <div className="joined-badge">✓</div>
        <p className="joined-nick">{savedNickname || nickname}</p>
        <p className="room-count">{participants.length} en la sala</p>
        <div className="room-list">
          {participants.map((p) => (
            <div key={p.id} className="room-participant">
              {p.nickname}{p.device_id === deviceId.current ? ' (tú)' : ''}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="disco-home">
      <p className="scan-title">Entra a la sala</p>
      <form className="nickname-form" onSubmit={handleJoin}>
        <input
          className="nickname-input"
          type="text"
          placeholder="Tu nombre"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button className="nickname-btn" type="submit">Entrar</button>
      </form>
      {error && <p className="scan-error">{error}</p>}
    </div>
  )
}
