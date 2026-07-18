import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { searchLastFmCandidates, type MusicSearchInput } from "./lastfm.ts"
import { AGENT_SYSTEM_PROMPT, AGENT_TOOLS } from "./contract.ts"

const GROQ_RESPONSES_URL = "https://api.groq.com/openai/v1/responses"
const DEFAULT_GROQ_MODEL = "qwen/qwen3.6-27b"
const MAX_QUESTIONS = 5

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type JsonObject = Record<string, any>

interface SessionRow {
  id: string
  access_token: string
  device_id: string
  status: "questioning" | "searching" | "completed"
  answers: QuestionAnswer[]
}

interface QuestionAnswer {
  key: string
  question: string
  options: string[]
  answer: string | null
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado"
}

function requiredText(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new ClientError(`${name} debe ser texto`)
  const normalized = value.trim().replace(/\s+/g, " ")
  if (normalized.length < min || normalized.length > max) {
    throw new ClientError(`${name} debe tener entre ${min} y ${max} caracteres`)
  }
  return normalized
}

function optionalText(value: unknown, max: number): string | null {
  if (value == null || value === "") return null
  return requiredText(value, "valor", 1, max)
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

class ClientError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function parseToolArguments(call: JsonObject): JsonObject {
  try {
    return typeof call.arguments === "string" ? JSON.parse(call.arguments) : (call.arguments ?? {})
  } catch {
    throw new Error(`Groq devolvió argumentos inválidos para ${call.name}`)
  }
}

async function callGroq(apiKey: string, model: string, input: unknown[]): Promise<JsonObject> {
  const response = await fetch(GROQ_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: AGENT_SYSTEM_PROMPT,
      input,
      tools: AGENT_TOOLS,
      tool_choice: "required",
      parallel_tool_calls: false,
      temperature: 0.35,
      max_output_tokens: 900,
    }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.error) {
    const detail = body?.error?.message || body?.message || `HTTP ${response.status}`
    throw new Error(`Groq no pudo continuar el cuestionario: ${String(detail).slice(0, 300)}`)
  }
  return body
}

function publicTrack(candidate: JsonObject): JsonObject {
  const search = encodeURIComponent(`${candidate.artist_name} ${candidate.track_name}`)
  return {
    id: candidate.id,
    title: candidate.track_name,
    artist: candidate.artist_name,
    image_url: candidate.metadata?.image_url ?? null,
    lastfm_url: candidate.lastfm_url,
    spotify_search_url: `https://open.spotify.com/search/${search}`,
    youtube_music_search_url: `https://music.youtube.com/search?q=${search}`,
  }
}

function questionPayload(session: SessionRow, includeToken = false): JsonObject {
  const answers = Array.isArray(session.answers) ? session.answers : []
  const pending = [...answers].reverse().find((item) => !item.answer)
  if (!pending) throw new Error("La sesión no tiene una pregunta pendiente")
  return {
    type: "question",
    session_id: session.id,
    ...(includeToken ? { access_token: session.access_token } : {}),
    question_key: pending.key,
    question: pending.question,
    options: pending.options,
    progress: { answered: answers.filter((item) => item.answer).length, maximum: MAX_QUESTIONS },
  }
}

async function recommendationPayload(db: any, sessionId: string, includeToken?: string): Promise<JsonObject> {
  const { data, error } = await db
    .from("daily_music_recommendations")
    .select("id, daily_vibe, reason, playlist, feedback, created_at")
    .eq("session_id", sessionId)
    .single()
  if (error) throw error
  return {
    type: "recommendation",
    session_id: sessionId,
    ...(includeToken ? { access_token: includeToken } : {}),
    recommendation_id: data.id,
    daily_vibe: data.daily_vibe,
    reason: data.reason,
    song: data.playlist[0],
    playlist: data.playlist,
    feedback: data.feedback,
    created_at: data.created_at,
  }
}

async function getSession(db: any, sessionId: unknown, token: unknown): Promise<SessionRow> {
  if (!isUuid(sessionId) || !isUuid(token)) throw new ClientError("session_id y access_token no son válidos")
  const { data, error } = await db
    .from("daily_music_sessions")
    .select("id, access_token, device_id, status, answers")
    .eq("id", sessionId)
    .eq("access_token", token)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ClientError("Sesión inexistente o token incorrecto", 404)
  return data as SessionRow
}

async function saveQuestion(db: any, session: SessionRow, args: JsonObject): Promise<SessionRow> {
  const previous = Array.isArray(session.answers) ? session.answers : []
  if (previous.some((item) => !item.answer)) throw new Error("Ya existe una pregunta pendiente")
  if (previous.length >= MAX_QUESTIONS) throw new Error("El agente excedió el máximo de preguntas")
  const key = requiredText(args.question_key, "question_key", 2, 30)
  const question = requiredText(args.question, "question", 5, 180)
  if (!Array.isArray(args.options) || args.options.length < 2 || args.options.length > 6) {
    throw new Error("El agente devolvió una cantidad inválida de opciones")
  }
  const options = [...new Set(args.options.map((option: unknown) => requiredText(option, "opción", 1, 70)))]
  if (options.length < 2) throw new Error("Las opciones de la pregunta deben ser diferentes")
  const answers = [...previous, { key, question, options, answer: null }]
  const { data, error } = await db
    .from("daily_music_sessions")
    .update({ answers, status: "questioning" })
    .eq("id", session.id)
    .select("id, access_token, device_id, status, answers")
    .single()
  if (error) throw error
  return data
}

async function searchMusic(db: any, session: SessionRow, args: JsonObject, lastFmKey: string): Promise<JsonObject[]> {
  if (!Array.isArray(args.desired_tags)) throw new Error("Groq no proporcionó desired_tags")
  const input: MusicSearchInput = {
    desired_tags: args.desired_tags.map((tag: unknown) => requiredText(tag, "tag", 1, 60)).slice(0, 3),
    seed_artist: optionalText(args.seed_artist, 300),
    seed_track: optionalText(args.seed_track, 300),
  }
  const candidates = await searchLastFmCandidates(lastFmKey, input)
  const rows = candidates.map((candidate) => ({ ...candidate, session_id: session.id }))
  const { data, error } = await db
    .from("daily_music_candidates")
    .upsert(rows, { onConflict: "session_id,provider_key" })
    .select("id, track_name, artist_name, source_type, source_value, score")
  if (error) throw error
  await db.from("daily_music_sessions").update({ status: "searching" }).eq("id", session.id)
  return (data ?? []).map((candidate: JsonObject) => ({
    id: candidate.id,
    title: candidate.track_name,
    artist: candidate.artist_name,
    source: `${candidate.source_type}:${candidate.source_value}`,
    relevance: Number(candidate.score),
  }))
}

async function saveRecommendation(db: any, session: SessionRow, args: JsonObject): Promise<JsonObject> {
  const primaryId = requiredText(args.primary_candidate_id, "primary_candidate_id", 10, 100)
  if (!Array.isArray(args.playlist_candidate_ids)) throw new Error("Groq no devolvió la playlist")
  const requestedIds = [...new Set([primaryId, ...args.playlist_candidate_ids])].slice(0, 6)
  if (!requestedIds.every(isUuid)) throw new Error("Groq intentó usar IDs de canciones inválidos")

  const { data: candidates, error: candidateError } = await db
    .from("daily_music_candidates")
    .select("id, track_name, artist_name, lastfm_url, metadata, score")
    .eq("session_id", session.id)
    .in("id", requestedIds)
  if (candidateError) throw candidateError
  if (!candidates || candidates.length !== requestedIds.length) {
    throw new Error("Groq intentó recomendar una canción que Last.fm no devolvió")
  }

  const byId = new Map(candidates.map((candidate: JsonObject) => [candidate.id, candidate]))
  const playlist = requestedIds.map((id) => publicTrack(byId.get(id)!))
  const dailyVibe = requiredText(args.daily_vibe, "daily_vibe", 1, 120)
  const reason = requiredText(args.reason, "reason", 1, 600)
  const { error } = await db.from("daily_music_recommendations").insert({
    session_id: session.id,
    primary_candidate_id: primaryId,
    daily_vibe: dailyVibe,
    reason,
    playlist,
  })
  if (error) throw error
  const { error: sessionError } = await db
    .from("daily_music_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", session.id)
  if (sessionError) throw sessionError
  return recommendationPayload(db, session.id)
}

async function runAgent(db: any, session: SessionRow, includeToken = false): Promise<JsonObject> {
  const groqKey = Deno.env.get("GROQ_API_KEY")
  const lastFmKey = Deno.env.get("LASTFM_API_KEY")
  if (!groqKey || !lastFmKey) {
    throw new Error("Faltan GROQ_API_KEY o LASTFM_API_KEY en el servidor de Edge Functions")
  }

  const model = Deno.env.get("GROQ_MODEL") || DEFAULT_GROQ_MODEL
  const answered = (session.answers ?? []).filter((item) => item.answer).map((item) => ({
    topic: item.key,
    question: item.question,
    answer: item.answer,
  }))
  let input: unknown[] = [{
    role: "user",
    content: `Estado actual de la sesión:\n${JSON.stringify({ answered, question_count: session.answers?.length ?? 0 })}`,
  }]

  for (let round = 0; round < 4; round += 1) {
    const response = await callGroq(groqKey, model, input)
    const calls = (response.output ?? []).filter((item: JsonObject) => item.type === "function_call")
    if (calls.length !== 1) throw new Error("Groq debía ejecutar exactamente una herramienta")
    const call = calls[0]
    const args = parseToolArguments(call)

    if (call.name === "ask_question") {
      const updated = await saveQuestion(db, session, args)
      return questionPayload(updated, includeToken)
    }
    if (call.name === "choose_recommendation") {
      const result = await saveRecommendation(db, session, args)
      return includeToken ? { ...result, access_token: session.access_token } : result
    }
    if (call.name !== "search_music") throw new Error(`Herramienta desconocida: ${call.name}`)

    const candidates = await searchMusic(db, session, args, lastFmKey)
    input = [
      ...input,
      ...(response.output ?? []),
      {
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify({ candidates }),
      },
    ]
  }
  throw new Error("El agente no terminó dentro del número máximo de pasos")
}

async function handleStart(db: any, body: JsonObject): Promise<JsonObject> {
  const deviceId = requiredText(body.device_id, "device_id", 8, 128)
  const { data, error } = await db
    .from("daily_music_sessions")
    .insert({ device_id: deviceId })
    .select("id, access_token, device_id, status, answers")
    .single()
  if (error?.code === "23505") {
    throw new ClientError("Ya existe una sesión para este dispositivo hoy. Continúa usando el token guardado.", 409)
  }
  if (error) throw error
  try {
    return await runAgent(db, data, true)
  } catch (agentError) {
    // El cliente todavía no recibió el token. Eliminar la sesión evita dejarlo
    // bloqueado por la restricción de una sesión diaria si Groq falla al iniciar.
    await db.from("daily_music_sessions").delete().eq("id", data.id)
    throw agentError
  }
}

async function handleAnswer(db: any, body: JsonObject): Promise<JsonObject> {
  const session = await getSession(db, body.session_id, body.access_token)
  if (session.status === "completed") return recommendationPayload(db, session.id)
  const answer = requiredText(body.answer, "answer", 1, 600)
  const answers = Array.isArray(session.answers) ? [...session.answers] : []
  const pendingIndex = answers.findIndex((item) => !item.answer)
  // Una respuesta anterior pudo guardarse aunque Groq/Last.fm fallara después.
  // Reintentar en ese caso continúa el agente sin duplicar la respuesta.
  if (pendingIndex < 0) return runAgent(db, session)
  answers[pendingIndex] = { ...answers[pendingIndex], answer }
  const { data, error } = await db
    .from("daily_music_sessions")
    .update({ answers })
    .eq("id", session.id)
    .select("id, access_token, device_id, status, answers")
    .single()
  if (error) throw error
  return runAgent(db, data)
}

async function handleStatus(db: any, body: JsonObject): Promise<JsonObject> {
  const session = await getSession(db, body.session_id, body.access_token)
  if (session.status === "completed") return recommendationPayload(db, session.id)
  const hasPendingQuestion = (session.answers ?? []).some((item) => !item.answer)
  return hasPendingQuestion ? questionPayload(session) : runAgent(db, session)
}

async function handleFeedback(db: any, body: JsonObject): Promise<JsonObject> {
  const session = await getSession(db, body.session_id, body.access_token)
  if (session.status !== "completed") throw new ClientError("La sesión todavía no tiene una recomendación", 409)
  if (!["liked", "disliked", "another"].includes(body.feedback)) {
    throw new ClientError("feedback debe ser liked, disliked o another")
  }
  const { error } = await db
    .from("daily_music_recommendations")
    .update({ feedback: body.feedback, feedback_at: new Date().toISOString() })
    .eq("session_id", session.id)
  if (error) throw error
  return recommendationPayload(db, session.id)
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405)
    try {
      const body = await req.json()
      const action = body?.action
      let result: JsonObject
      if (action === "start") result = await handleStart(ctx.supabaseAdmin, body)
      else if (action === "answer") result = await handleAnswer(ctx.supabaseAdmin, body)
      else if (action === "status") result = await handleStatus(ctx.supabaseAdmin, body)
      else if (action === "feedback") result = await handleFeedback(ctx.supabaseAdmin, body)
      else throw new ClientError("action debe ser start, answer, status o feedback")
      return json(result)
    } catch (error) {
      console.error("daily-dj-agent", messageOf(error))
      const status = error instanceof ClientError ? error.status : 500
      return json({ error: messageOf(error) }, status)
    }
  }),
}
