import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { searchLastFmCandidates, type LastFmCandidate } from "./lastfm.ts"
import { AGENT_SYSTEM_PROMPT } from "./contract.ts"
const LLM_URL = "https://flit-gemma.qallariy.lat/model/chat/completions"

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
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>
    return String(obj.message ?? obj.error ?? obj.details ?? JSON.stringify(error))
  }
  return String(error)
}

function requiredText(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new ClientError(`${name} debe ser texto`)
  const normalized = value.trim().replace(/\s+/g, " ")
  if (normalized.length < min || normalized.length > max) {
    throw new ClientError(`${name} debe tener entre ${min} y ${max} caracteres`)
  }
  return normalized
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

class ClientError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
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
    progress: { answered: answers.filter((item) => item.answer).length, maximum: 5 },
  }
}

async function recommendationPayload(
  db: any,
  sessionId: string,
  includeToken?: string,
): Promise<JsonObject> {
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

async function getSession(
  db: any,
  sessionId: unknown,
  token: unknown,
): Promise<SessionRow> {
  if (!isUuid(sessionId) || !isUuid(token)) {
    throw new ClientError("session_id y access_token no son válidos")
  }
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

async function callLLM(messages: unknown[]): Promise<string> {
  console.error("[callLLM] URL:", LLM_URL, "messages count:", messages.length)
  console.error("[callLLM] messages:", JSON.stringify(messages).slice(0, 500))
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let res: Response
  try {
    res = await fetch(LLM_URL, {
      method: "POST", headers,
      body: JSON.stringify({ messages, temperature: 0.35, max_tokens: 900, stream: false }),
      signal: AbortSignal.timeout(30000),
    })
    console.error("[callLLM] response status:", res.status, res.statusText)
  } catch (e) {
    console.error("[callLLM] fetch failed:", String(e))
    throw new Error(`LLM fetch failed: ${String(e).slice(0, 300)}`)
  }
  let body: any
  try {
    body = await res.json()
    console.error("[callLLM] response body:", JSON.stringify(body).slice(0, 300))
  } catch (e) {
    console.error("[callLLM] JSON parse failed:", String(e))
    const text = await res.text().catch(() => "")
    console.error("[callLLM] raw response:", text.slice(0, 300))
    throw new Error(`LLM response not JSON: ${text.slice(0, 200)}`)
  }
  if (!res.ok || body?.error) {
    const detail = body?.error?.message || body?.message || `HTTP ${res.status}`
    console.error("[callLLM] error response:", detail)
    throw new Error(`LLM error: ${String(detail).slice(0, 300)}`)
  }
  const content = body.choices?.[0]?.message?.content ?? ""
  console.error("[callLLM] content:", content.slice(0, 200))
  return content
}

function buildUserContextBlock(_deviceId: string): string {
  return ""
}

function generateTagPrompt(conversation: string): string {
  return `Basado en esta conversación sobre el estado de ánimo del usuario:

"${conversation}"

Genera una lista de 3 a 6 tags de música que reflejen las emociones y el estado de ánimo descritos.
Los tags deben ser en español, incluyendo géneros musicales, estados de ánimo, estilos y vibes.
Ejemplos: "música alegre", "rock energético", "chill melancholy", "latin pop", "música para relajarse", "electrónica", "baladas románticas", "indie folk", "música motivacional", "ritmos bailables", "música instrumental", "punk", "reggaetón", "salsa", "música clásica", "jazz", "hip hop", "R&B", "música acústica", "k-pop", "música africana", "rock clásico", "metal", "blues", "country", "música experimental", "lo-fi", "música para dormir", "música para concentrarse", "música para hacer ejercicio"

SOLO responde con los tags separados por comas. Sin explicaciones ni intro.`
}

async function askNextQuestion(db: any, session: SessionRow, includeToken: boolean): Promise<JsonObject> {
  const answered = session.answers.filter(a => a.answer)
  console.error("[askNextQuestion] START answered count:", answered.length, "session:", session.id)
  console.error("[askNextQuestion] answered details:", JSON.stringify(answered))

  const contextBlock = buildUserContextBlock(session.device_id)
  const messages: JsonObject[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: contextBlock ? `Contexto del usuario:\n${contextBlock}` : "No hay contexto adicional." },
  ]
  for (const a of answered) {
    messages.push({ role: "assistant", content: a.question })
    messages.push({ role: "user", content: a.answer! })
  }
  messages.push({ role: "user", content: "Haz una pregunta corta. Máximo 2 oraciones." })

  console.error("[askNextQuestion] calling LLM with", messages.length, "messages")
  const llmText = await callLLM(messages)
  console.error("[askNextQuestion] LLM returned question:", llmText)

  const key = ["mood", "energy", "intention", "discovery"][answered.length] || "discovery"
  const newAnswers = [...session.answers, { key, question: llmText, options: [], answer: null }]
  console.error("[askNextQuestion] saving newAnswers:", JSON.stringify(newAnswers))
  const { error } = await db.from("daily_music_sessions").update({ answers: newAnswers }).eq("id", session.id)
  if (error) { console.error("[askNextQuestion] DB update error:", error); throw error }

  console.error("[askNextQuestion] END returning question payload")
  return questionPayload({ ...session, answers: newAnswers }, includeToken)
}

async function handleRecommendation(db: any, session: SessionRow, includeToken: boolean): Promise<JsonObject> {
  const answered = session.answers.filter(a => a.answer)
  const allText = answered.map(a => `${a.question} ${a.answer}`).join(" ")
  console.error("[handleRecommendation] START full conversation:", allText)

  // LLM generates search tags based on conversation
  const tagPrompt = generateTagPrompt(allText)
  console.error("[handleRecommendation] calling LLM for tag generation")
  let tags: string[] = []
  try {
    const llmTags = await callLLM([
      { role: "user", content: "Eres un asistente que genera tags musicales basados en estados de ánimo." },
      { role: "user", content: tagPrompt },
    ])
    tags = llmTags.split(",").map(t => t.trim().toLowerCase()).filter(t => t.length > 0 && t.length <= 60)
    if (tags.length === 0) tags = ["música variada"]
    console.error("[handleRecommendation] LLM generated tags:", tags)
  } catch (e) {
    console.error("[handleRecommendation] LLM tag generation failed:", String(e))
    tags = ["pop", "rock", "latin", "música alegre", "música para sentirse bien"]
    console.error("[handleRecommendation] using fallback tags:", tags)
  }

  console.error("[handleRecommendation] searching Last.fm with tags:", tags)
  const candidates = await searchLastFmCandidates("daf019cb0f3fbf8cc66db66d034e11ee", { desired_tags: tags, seed_artist: null, seed_track: null }).catch((e) => {
    console.error("[handleRecommendation] Last.fm search failed:", String(e))
    return [] as LastFmCandidate[]
  })
  console.error("[handleRecommendation] Last.fm returned", candidates.length, "candidates")

  const top = candidates.slice(0, 5)
  console.error("[handleRecommendation] top 5 candidates:", top.map(c => `${c.track_name} - ${c.artist_name}`))

  await db.from("daily_music_candidates").upsert(
    top.map(c => ({ ...c, session_id: session.id })),
    { onConflict: "session_id,provider_key", ignoreDuplicates: true },
  ).then(() => {}, () => {})

  const { data: savedCandidates, error: fetchErr } = await db
    .from("daily_music_candidates")
    .select("id, provider_key, track_name, artist_name, lastfm_url, mbid, source_type, source_value, score, metadata")
    .eq("session_id", session.id)
    .order("score", { ascending: false })
    .limit(5)
  if (fetchErr) { console.error("[handleRecommendation] fetch candidates error:", fetchErr); throw fetchErr }
  if (!savedCandidates?.length) { console.error("[handleRecommendation] no saved candidates"); throw new Error("No se pudieron guardar los candidatos") }
  console.error("[handleRecommendation] saved candidates with IDs:", savedCandidates.map(c => ({ id: c.id, track: c.track_name })))

  const contextBlock = buildUserContextBlock(session.device_id)
  const messages: JsonObject[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: contextBlock ? `Contexto del usuario:\n${contextBlock}` : "No hay contexto adicional." },
  ]
  for (const a of answered) {
    messages.push({ role: "assistant", content: a.question })
    messages.push({ role: "user", content: a.answer! })
  }
  messages.push({
    role: "user",
    content: `Aquí hay canciones reales de nuestra biblioteca musical. Elige una y recomiéndala, explicando por qué va con el estado de ánimo del usuario.\n\nCanciones disponibles:\n${savedCandidates.map((c, i) => `${i + 1}. "${c.track_name}" — ${c.artist_name}`).join("\n")}\n\nRecomienda UNA canción. Máximo 3 oraciones.`,
  })

  console.error("[handleRecommendation] calling LLM for recommendation")
  let llmText = ""
  try {
    llmText = await callLLM(messages)
    console.error("[handleRecommendation] LLM recommendation OK, length:", llmText.length)
  } catch (e) {
    console.error("[handleRecommendation] LLM recommendation call failed:", String(e))
    llmText = ""
  }
  if (!llmText) {
    llmText = `Te recomiendo "${savedCandidates[0].track_name}" de ${savedCandidates[0].artist_name}.`
    console.error("[handleRecommendation] using fallback reason:", llmText)
  }

  const primary = savedCandidates[0]
  const playlist = savedCandidates.slice(0, 4)

  console.error("[handleRecommendation] inserting recommendation, primary id:", primary?.id, "primary track:", primary?.track_name)
  const vibe = tags.join(", ").slice(0, 120) || "música variada"
  console.error("[handleRecommendation] vibe:", vibe)
  console.error("[handleRecommendation] reason:", llmText.slice(0, 200))
  console.error("[handleRecommendation] playlist tracks:", playlist.map(c => c.track_name))
  const { error: recError } = await db.from("daily_music_recommendations").insert({
    session_id: session.id,
    primary_candidate_id: primary.id,
    daily_vibe: vibe,
    reason: llmText.slice(0, 600),
    playlist: playlist.map(c => publicTrack(c)),
  })
  if (recError) { console.error("[handleRecommendation] insert error:", recError); throw recError }

  console.error("[handleRecommendation] marking session completed")
  await db.from("daily_music_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", session.id).then(() => {}, () => {})
  console.error("[handleRecommendation] END returning recommendation payload")
  return recommendationPayload(db, session.id, includeToken ? session.access_token : undefined)
}

async function runAgent(db: any, session: SessionRow, includeToken = false): Promise<JsonObject> {
  console.error("[runAgent] START session:", session.id)
  console.error("[runAgent] all answers:", JSON.stringify(session.answers))

  const answeredCount = session.answers.filter(a => a.answer).length
  console.error("[runAgent] answered count:", answeredCount)

  if (answeredCount >= 3) {
    console.error("[runAgent] answeredCount >= 3, calling handleRecommendation")
    return handleRecommendation(db, session, includeToken)
  } else {
    console.error("[runAgent] answeredCount < 3, calling askNextQuestion")
    return askNextQuestion(db, session, includeToken)
  }
}

async function createSession(db: any, deviceId: string, initialAnswers: QuestionAnswer[]): Promise<SessionRow> {
  console.error("[createSession] device:", deviceId, "initialAnswers:", JSON.stringify(initialAnswers))
  const today = new Date().toISOString().slice(0, 10)
  console.error("[createSession] deleting any existing session for device:", deviceId, "on:", today)
  await db.from("daily_music_sessions").delete().eq("device_id", deviceId).gte("created_at", today)
  console.error("[createSession] inserting fresh session")
  const { data, error } = await db
    .from("daily_music_sessions")
    .insert({ device_id: deviceId, answers: initialAnswers })
    .select("id, access_token, device_id, status, answers")
    .single()
  if (error) {
    console.error("[createSession] insert error:", error)
    throw error
  }
  console.error("[createSession] created fresh session:", data.id)
  return data as SessionRow
}

async function resumeOrRun(db: any, session: SessionRow): Promise<JsonObject> {
  console.error("[resumeOrRun] session:", session.id, "status:", session.status, "answers:", JSON.stringify(session.answers))
  if (session.status === "completed") {
    console.error("[resumeOrRun] session completed, returning recommendation")
    return recommendationPayload(db, session.id, session.access_token)
  }
  const hasPendingQuestion = (session.answers ?? []).some((a: QuestionAnswer) => !a.answer)
  if (hasPendingQuestion) {
    console.error("[resumeOrRun] has pending question, returning it")
    return questionPayload(session, true)
  }
  console.error("[resumeOrRun] no pending question, running agent")
  return runAgent(db, session, true)
}

async function handleStart(db: any, body: JsonObject): Promise<JsonObject> {
  console.error("[handleStart] body:", JSON.stringify(body))
  const deviceId = requiredText(body.device_id, "device_id", 8, 128)
  const initialMood = Number(body.initial_mood)
  console.error("[handleStart] deviceId:", deviceId, "initialMood:", initialMood)
  const initialAnswers: QuestionAnswer[] =
    Number.isInteger(initialMood) && initialMood >= 0 && initialMood <= 10
      ? [{
        key: "mood",
        question: "¿Cómo te sientes hoy?",
        options: [],
        answer: `${initialMood}/10 de bienestar emocional`,
      }]
      : []

  console.error("[handleStart] initialAnswers:", JSON.stringify(initialAnswers))
  const session = await createSession(db, deviceId, initialAnswers)
  try {
    console.error("[handleStart] session ready, calling resumeOrRun")
    return await resumeOrRun(db, session)
  } catch (agentError) {
    console.error("[handleStart] agent error:", String(agentError), "deleting session:", session.id)
    await db.from("daily_music_sessions").delete().eq("id", session.id).then(() => {}, () => {})
    throw agentError
  }
}

async function handleAnswer(db: any, body: JsonObject): Promise<JsonObject> {
  console.error("[handleAnswer] body:", JSON.stringify(body))
  const session = await getSession(db, body.session_id, body.access_token)
  console.error("[handleAnswer] session:", session.id, "status:", session.status, "answers:", JSON.stringify(session.answers))
  if (session.status === "completed") return recommendationPayload(db, session.id)
  const answer = requiredText(body.answer, "answer", 1, 600)
  const answers = Array.isArray(session.answers) ? [...session.answers] : []
  const pendingIndex = answers.findIndex((item) => !item.answer)
  if (pendingIndex < 0) { console.error("[handleAnswer] no pending question, running agent directly"); return runAgent(db, session) }
  answers[pendingIndex] = { ...answers[pendingIndex], answer }
  console.error("[handleAnswer] saving answer at index:", pendingIndex, "answer:", answer)
  console.error("[handleAnswer] full answers after save:", JSON.stringify(answers))
  const { data, error } = await db
    .from("daily_music_sessions")
    .update({ answers })
    .eq("id", session.id)
    .select("id, access_token, device_id, status, answers")
    .single()
  if (error) { console.error("[handleAnswer] update error:", error); throw error }
  console.error("[handleAnswer] answer saved, running agent")
  return runAgent(db, data)
}

async function handleStatus(db: any, body: JsonObject): Promise<JsonObject> {
  console.error("[handleStatus] body:", JSON.stringify(body))
  const session = await getSession(db, body.session_id, body.access_token)
  console.error("[handleStatus] session:", session.id, "status:", session.status, "answers:", JSON.stringify(session.answers))
  if (session.status === "completed") return recommendationPayload(db, session.id)
  const hasPendingQuestion = (session.answers ?? []).some((item) => !item.answer)
  if (hasPendingQuestion) { console.error("[handleStatus] returning pending question"); return questionPayload(session) }
  console.error("[handleStatus] running agent")
  return runAgent(db, session)
}

async function handleFeedback(db: any, body: JsonObject): Promise<JsonObject> {
  console.error("[handleFeedback] body:", JSON.stringify(body))
  const session = await getSession(db, body.session_id, body.access_token)
  if (session.status !== "completed") {
    throw new ClientError("La sesión todavía no tiene una recomendación", 409)
  }
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
      console.error("[handler] ====== INCOMING REQUEST ======")
      console.error("[handler] action:", body?.action)
      console.error("[handler] full body:", JSON.stringify(body))
      console.error("[handler] ==============================")
      const action = body?.action
      let result: JsonObject
      if (action === "start") result = await handleStart(ctx.supabaseAdmin, body)
      else if (action === "answer") result = await handleAnswer(ctx.supabaseAdmin, body)
      else if (action === "status") result = await handleStatus(ctx.supabaseAdmin, body)
      else if (action === "feedback") result = await handleFeedback(ctx.supabaseAdmin, body)
      else throw new ClientError("action debe ser start, answer, status o feedback")
      console.error("[handler] response:", JSON.stringify(result).slice(0, 300))
      return json(result)
    } catch (error) {
      console.error("[handler] ====== ERROR ======")
      console.error("[handler] message:", messageOf(error))
      console.error("[handler] stack:", error instanceof Error ? error.stack : "")
      console.error("[handler] ====================")
      const status = error instanceof ClientError ? error.status : 500
      return json({ error: messageOf(error) }, status)
    }
  }),
}
