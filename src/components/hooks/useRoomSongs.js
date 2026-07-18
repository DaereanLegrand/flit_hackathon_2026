import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'

export default function useRoomSongs(qr_hash, deviceId) {
  const [songs, setSongs] = useState([])
  const [votedKeys, setVotedKeys] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!qr_hash) return

    setLoading(true)

    supabase
      .from('room_votes')
      .select('*')
      .eq('qr_hash', qr_hash)
      .then(({ data }) => {
        const votesMap = {}
        const votedSet = new Set()
        for (const v of data || []) {
          const key = `${v.title}|${v.artist}`
          if (!votesMap[key]) {
            votesMap[key] = { title: v.title, artist: v.artist, cover_url: v.cover_url, vote_count: 0 }
          }
          votesMap[key].vote_count++
          if (v.device_id === deviceId) votedSet.add(key)
        }
        const list = Object.values(votesMap)
          .map(entry => ({
            id: `${entry.title}|${entry.artist}`,
            title: entry.title,
            artist: entry.artist,
            coverUrl: entry.cover_url,
            vote_count: entry.vote_count,
          }))
          .sort((a, b) => b.vote_count - a.vote_count || a.title.localeCompare(b.title))
        setSongs(list)
        setVotedKeys(votedSet)
        setLoading(false)
      })

    const channel = supabase
      .channel(`room-songs-${qr_hash}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_votes',
          filter: `qr_hash=eq.${qr_hash}`,
        },
        (payload) => {
          const v = payload.new
          const key = `${v.title}|${v.artist}`
          setSongs(prev => {
            const map = {}
            for (const s of prev) map[s.id] = s
            if (map[key]) {
              map[key] = { ...map[key], vote_count: map[key].vote_count + 1 }
            } else {
              map[key] = {
                id: key,
                title: v.title,
                artist: v.artist,
                coverUrl: v.cover_url,
                vote_count: 1,
              }
            }
            return Object.values(map).sort(
              (a, b) => b.vote_count - a.vote_count || a.title.localeCompare(b.title)
            )
          })
          if (v.device_id === deviceId) {
            setVotedKeys(prev => new Set(prev).add(key))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qr_hash, deviceId])

  const addSong = useCallback(async (title, artist, coverUrl) => {
    if (!qr_hash || !deviceId) return { ok: false, error: 'No room or device' }
    const { error } = await supabase.from('room_votes').insert({
      qr_hash,
      device_id: deviceId,
      title,
      artist,
      cover_url: coverUrl || null,
    })
    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Ya votaste por esta canción' }
      return { ok: false, error: error.message }
    }
    return { ok: true, error: null }
  }, [qr_hash, deviceId])

  return { songs, addSong, votedKeys, loading }
}
