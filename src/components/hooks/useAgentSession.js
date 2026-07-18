import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../supabase'

function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('device_id', id)
  }
  return id
}

async function invokeAgent(body) {
  const { data, error } = await supabase.functions.invoke('daily-dj-agent', { body })
  if (error) {
    const contextBody = await error.context?.json?.().catch(() => null)
    throw new Error(data?.error || contextBody?.error || error.message || 'No se pudo contactar al agente')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export default function useAgentSession(initialMood) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastResult = useRef(null)

  const run = useCallback(async (body) => {
    setLoading(true)
    setError('')
    try {
      const data = await invokeAgent(body)
      lastResult.current = data
      setResult(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const start = useCallback((mood) => {
    return run({ action: 'start', device_id: getDeviceId(), initial_mood: mood })
  }, [run])

  const answer = useCallback((value) => {
    const r = lastResult.current
    if (!r?.session_id || !r?.access_token || !value?.trim()) return
    return run({ action: 'answer', session_id: r.session_id, access_token: r.access_token, answer: value.trim() })
  }, [run])

  const feedback = useCallback((value) => {
    const r = lastResult.current
    if (!r?.session_id || !r?.access_token) return
    return run({ action: 'feedback', session_id: r.session_id, access_token: r.access_token, feedback: value })
  }, [run])

  useEffect(() => {
    if (initialMood !== undefined && initialMood !== null) {
      start(initialMood)
    }
  }, [initialMood])

  return { result, loading, error, answer, feedback }
}
