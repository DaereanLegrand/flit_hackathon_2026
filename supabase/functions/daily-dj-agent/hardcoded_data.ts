export interface HardcodedUserProfile {
  device_id: string
  display_name: string
  timezone: string
  telegram_user_id: number
  telegram_chat_id: number
}

export interface HardcodedMessage {
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
}

export interface HardcodedNotification {
  source: string
  title: string
  body: string
  category: string
  importance: "low" | "normal" | "high" | "urgent"
}

export interface HardcodedCalendarEvent {
  title: string
  start: string
  end: string
  description: string
}

export interface HardcodedEmail {
  from: string
  subject: string
  snippet: string
  received_at: string
}

export interface HardcodedListeningHistory {
  kind: "artist" | "track" | "genre"
  name: string
  artist?: string
  score: number
}

export interface HardcodedUserContext {
  profile: HardcodedUserProfile
  today_chat: HardcodedMessage[]
  today_notifications: HardcodedNotification[]
  today_calendar: HardcodedCalendarEvent[]
  today_email: HardcodedEmail[]
  listening_history: HardcodedListeningHistory[]
  past_interactions: string[]
}

const DEVICE_SAMPLES: Record<string, Partial<HardcodedUserContext>> = {
  "default": {
    profile: {
      device_id: "default",
      display_name: "Alex",
      timezone: "America/Lima",
      telegram_user_id: 123456789,
      telegram_chat_id: 123456789,
    },
    today_chat: [
      { role: "user", content: "Hoy tuve un día pesado en el trabajo", created_at: "2026-07-18T09:15:00Z" },
      { role: "assistant", content: "¿Qué pasó? Cuéntame", created_at: "2026-07-18T09:15:05Z" },
      { role: "user", content: "Muchas reuniones y una entrega importante. Necesito desconectar", created_at: "2026-07-18T09:16:00Z" },
      { role: "user", content: "¿Tienes música para relajarme?", created_at: "2026-07-18T09:16:30Z" },
    ],
    today_notifications: [
      { source: "calendar", title: "Recordatorio: Revisión de sprint", body: "Reunión en 30 minutos", category: "meeting", importance: "high" },
      { source: "system", title: "Clima", body: "18°C en Arequipa, cielo despejado", category: "weather", importance: "low" },
    ],
    today_calendar: [
      { title: "Sprint Review", start: "2026-07-18T10:00:00Z", end: "2026-07-18T11:00:00Z", description: "Revisión semanal con el equipo" },
      { title: "Almuerzo con María", start: "2026-07-18T13:00:00Z", end: "2026-07-18T14:00:00Z", description: "Restaurante peruano" },
    ],
    today_email: [
      { from: "jefe@empresa.com", subject: "Felicidades por la entrega", snippet: "Excelente trabajo en el proyecto. El cliente quedó muy satisfecho.", received_at: "2026-07-18T08:30:00Z" },
      { from: "notificaciones@spotify.com", subject: "Tu playlist semanal", snippet: "Nuevas canciones basadas en tus gustos", received_at: "2026-07-18T07:00:00Z" },
    ],
    listening_history: [
      { kind: "artist", name: "Radiohead", score: 0.9 },
      { kind: "artist", name: "Natalia Lafourcade", score: 0.85 },
      { kind: "genre", name: "rock alternativo", score: 0.8 },
      { kind: "genre", name: "música latina", score: 0.75 },
      { kind: "track", name: "Karma Police", artist: "Radiohead", score: 0.9 },
      { kind: "track", name: "Hasta la Raíz", artist: "Natalia Lafourcade", score: 0.85 },
    ],
    past_interactions: ["liked:relax", "liked:acoustic", "disliked:heavy_metal"],
  },
  "alex-2": {
    profile: {
      device_id: "alex-2",
      display_name: "Alex",
      timezone: "America/Lima",
      telegram_user_id: 123456789,
      telegram_chat_id: 123456789,
    },
    today_chat: [
      { role: "user", content: "¡Hoy es viernes! Ganas de fiesta", created_at: "2026-07-18T18:00:00Z" },
      { role: "assistant", content: "Suena bien. ¿Qué plans?", created_at: "2026-07-18T18:00:05Z" },
      { role: "user", content: "Salir con amigos, necesito música alegre", created_at: "2026-07-18T18:01:00Z" },
    ],
    today_notifications: [
      { source: "telegram", title: "Mensaje de grupo", body: "Amigos: Nos vemos a las 9 en La Plaza", category: "social", importance: "high" },
    ],
    today_calendar: [],
    today_email: [],
    listening_history: [
      { kind: "artist", name: "Daft Punk", score: 0.95 },
      { kind: "artist", name: "Bad Bunny", score: 0.9 },
      { kind: "genre", name: "electrónica", score: 0.85 },
      { kind: "genre", name: "reguetón", score: 0.8 },
    ],
    past_interactions: ["liked:dance", "liked:party"],
  },
  "maria-3": {
    profile: {
      device_id: "maria-3",
      display_name: "María",
      timezone: "America/Mexico_City",
      telegram_user_id: 987654321,
      telegram_chat_id: 987654321,
    },
    today_chat: [
      { role: "user", content: "Estoy estudiando para un examen y me distraigo fácilmente", created_at: "2026-07-18T14:00:00Z" },
    ],
    today_notifications: [
      { source: "calendar", title: "Examen final", body: "Mañana a las 8am", category: "academic", importance: "urgent" },
    ],
    today_calendar: [
      { title: "Estudio libre", start: "2026-07-18T14:00:00Z", end: "2026-07-18T20:00:00Z", description: "Repasar para el examen" },
    ],
    today_email: [],
    listening_history: [
      { kind: "genre", name: "lo-fi", score: 0.9 },
      { kind: "genre", name: "música clásica", score: 0.85 },
      { kind: "artist", name: "Hans Zimmer", score: 0.8 },
    ],
    past_interactions: ["liked:study", "liked:instrumental"],
  },
}

export function getUserContext(deviceId: string): HardcodedUserContext {
  const sample = DEVICE_SAMPLES[deviceId] || DEVICE_SAMPLES["default"]
  return {
    profile: {
      device_id: deviceId,
      display_name: "Usuario",
      timezone: "America/Lima",
      telegram_user_id: 0,
      telegram_chat_id: 0,
      ...sample.profile,
    },
    today_chat: sample.today_chat ?? [],
    today_notifications: sample.today_notifications ?? [],
    today_calendar: sample.today_calendar ?? [],
    today_email: sample.today_email ?? [],
    listening_history: sample.listening_history ?? [],
    past_interactions: sample.past_interactions ?? [],
  }
}
