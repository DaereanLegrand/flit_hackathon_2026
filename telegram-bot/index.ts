import { Bot, type Context, session, type SessionFlavor, InlineKeyboard } from "grammy"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

interface SessionData {
  deviceId: string | null
  pendingAction: string | null
}

type MyContext = Context & SessionFlavor<SessionData>

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const SUPABASE_API_URL = process.env.SUPABASE_API_URL || "https://flit-api.qallariy.lat"
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ""
const MCP_PORT = Number(process.env.MCP_PORT || "3100")
const BOT_PORT = Number(process.env.BOT_PORT || "3101")

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is required")
  process.exit(1)
}

const supabaseHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (SUPABASE_ANON_KEY) {
    headers["apikey"] = SUPABASE_ANON_KEY
    headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`
  }
  return headers
}

async function supabaseFetch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${SUPABASE_API_URL}${path}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase error ${res.status}: ${text}`)
  }
  return res.json()
}

function getDeviceId(ctx: MyContext): string {
  return `telegram_${ctx.from?.id || "unknown"}`
}

const SAMPLE_RESPONSES: Record<string, string> = {
  "hola": "¡Hola! ¿Cómo estuvo tu día? Puedo ayudarte a encontrar música para tu estado de ánimo. Escribe /vibe para empezar.",
  "bien": "¡Qué bueno! ¿Qué tipo de música te gusta hoy?",
  "mal": "Lo siento. A veces la música ayuda. ¿Quieres que te recomiende algo relajante?",
  "cansado": "Un día agotador. ¿Te gustaría música tranquila para descansar?",
  "feliz": "¡Excelente! ¿Música alegre para celebrar?",
  "triste": "Ánimo. La música puede ayudar. ¿Prefieres algo melancólico o algo que te suba el ánimo?",
}

function getBotResponse(text: string): string | null {
  const lower = text.toLowerCase().trim()
  for (const [key, response] of Object.entries(SAMPLE_RESPONSES)) {
    if (lower.includes(key)) return response
  }
  return null
}

async function storeChatMessage(deviceId: string, role: "user" | "assistant" | "system", content: string): Promise<void> {
  try {
    await supabaseFetch("/rest/v1/telegram_chat_context", {
      device_id: deviceId,
      role,
      content: content.slice(0, 4096),
      metadata: {},
    })
  } catch (err) {
    console.error("Failed to store chat message:", err)
  }
}

async function storeNotification(deviceId: string, title: string, body: string, category: string): Promise<void> {
  try {
    await supabaseFetch("/rest/v1/user_notifications", {
      device_id: deviceId,
      source: "telegram",
      title: title.slice(0, 255),
      body: body.slice(0, 1000) || null,
      category: category.slice(0, 100),
      importance: "normal",
      is_read: false,
      metadata: {},
    })
  } catch (err) {
    console.error("Failed to store notification:", err)
  }
}

async function triggerVibeRecommendation(deviceId: string): Promise<void> {
  try {
    await supabaseFetch("/functions/v1/daily-dj-agent", {
      action: "start",
      device_id: deviceId,
    })
  } catch (err) {
    console.error("Failed to start vibe agent:", err)
  }
}

const bot = new Bot<MyContext>(BOT_TOKEN)

bot.use(session({ initial: (): SessionData => ({ deviceId: null, pendingAction: null }) }))

bot.command("start", async (ctx: MyContext) => {
  const deviceId = getDeviceId(ctx)
  ctx.session.deviceId = deviceId
  await storeChatMessage(deviceId, "system", "Usuario inició el bot")

  const keyboard = new InlineKeyboard()
    .text("🎵 Mi Vibe Hoy", "vibe_now")
    .text("📋 Mis Gustos", "my_tastes")

  await ctx.reply(
    "🎧 *Bienvenido a FLIT · disco*\n\n" +
    "Soy tu DJ personal. Puedo recomendarte música según cómo te sientes.\n\n" +
    "• /vibe — Cuestionario rápido y recomendación\n" +
    "• /tastes — Ver o actualizar tus gustos musicales\n" +
    "• Escribe lo que sea y conversamos",
    { parse_mode: "Markdown", reply_markup: keyboard },
  )
  await storeChatMessage(deviceId, "assistant", "Mensaje de bienvenida enviado")
})

bot.command("vibe", async (ctx: MyContext) => {
  const deviceId = getDeviceId(ctx)
  ctx.session.deviceId = deviceId
  ctx.session.pendingAction = "vibe"

  await ctx.reply(
    "🎵 *Iniciando tu Vibe musical...*\n\n" +
    "Dime cómo te sientes hoy o qué tipo de música buscas.\n" +
    "Ej: *\"Estoy con mucha energía\"* o *\"Quiero algo relajante\"*",
    { parse_mode: "Markdown" },
  )
  await storeChatMessage(deviceId, "assistant", "Solicitando estado de ánimo para vibe")
})

bot.command("tastes", async (ctx: MyContext) => {
  const deviceId = getDeviceId(ctx)
  ctx.session.deviceId = deviceId

  await ctx.reply(
    "📋 *Tus gustos musicales (hardcoded)*\n\n" +
    "• Artistas: Radiohead, Natalia Lafourcade\n" +
    "• Géneros: rock alternativo, música latina\n" +
    "• Última interacción: le gusta música relajante\n\n" +
    "¿Quieres actualizar tus gustos? Describe tu artista o género favorito.",
    { parse_mode: "Markdown" },
  )
})

bot.on("message:text", async (ctx: MyContext) => {
  const deviceId = getDeviceId(ctx)
  const text = ctx.message.text
  ctx.session.deviceId = deviceId

  await storeChatMessage(deviceId, "user", text)

  await storeNotification(deviceId, `Mensaje de ${ctx.from?.first_name || "usuario"}`, text, "chat")

  const response = getBotResponse(text)
  if (response) {
    await ctx.reply(response)
    await storeChatMessage(deviceId, "assistant", response)
    return
  }

  if (ctx.session.pendingAction === "vibe") {
    ctx.session.pendingAction = null
    await ctx.reply("🎧 Genial, estoy procesando tu estado de ánimo... Dame un momento.")
    await storeChatMessage(deviceId, "assistant", "Procesando estado de ánimo para recomendación")
    try {
      await triggerVibeRecommendation(deviceId)
    } catch {
      // fallback hardcoded response
    }
    await ctx.reply(
      "✨ *Recomendación del día:*\n\n" +
      "🎵 *Karma Police* — Radiohead\n" +
      "💬 *Porque parece que necesitas un momento de introspección.*\n\n" +
      "Escúchala en: [Spotify](https://open.spotify.com/search/Karma%20Police) · [YouTube Music](https://music.youtube.com/search?q=Karma%20Police)",
      { parse_mode: "Markdown" },
    )
    await storeChatMessage(deviceId, "assistant", "Recomendación: Karma Police - Radiohead")
    return
  }

  await ctx.reply(
    "No estoy seguro de entender. Prueba:\n" +
    "• /vibe — Para recomendación musical\n" +
    "• /tastes — Para ver gustos\n" +
    "• O dime cómo te sientes",
  )
  await storeChatMessage(deviceId, "assistant", "Respuesta genérica: no entendí")
})

bot.on("callback_query:data", async (ctx: MyContext) => {
  const data = ctx.callbackQuery.data
  const deviceId = getDeviceId(ctx)

  if (data === "vibe_now") {
    await ctx.answerCallbackQuery()
    await ctx.reply("Dime cómo te sientes hoy")
    ctx.session.pendingAction = "vibe"
  } else if (data === "my_tastes") {
    await ctx.answerCallbackQuery()
    await ctx.reply(
      "Tus gustos actuales:\n• Rock alternativo\n• Música latina\n• Radiohead, Natalia Lafourcade",
    )
  }
})

// ── MCP Server (exposes chat context & user data) ──────────────────────

interface JsonRpcMessage {
  jsonrpc: "2.0"
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string }
}

const MCP_TOOLS = [
  {
    name: "get_chat_context",
    description: "Obtiene los mensajes recientes de chat de Telegram para un dispositivo",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "ID del dispositivo/usuario" },
        limit: { type: "number", description: "Cantidad de mensajes (default 10)" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_chat_summary_today",
    description: "Resume la conversación de hoy del usuario en Telegram",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "ID del dispositivo/usuario" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_user_info",
    description: "Obtiene información del perfil de Telegram del usuario",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "ID del dispositivo/usuario" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_user_notifications",
    description: "Obtiene notificaciones recientes desde Telegram u otros servicios",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "ID del dispositivo/usuario" },
        limit: { type: "number", description: "Cantidad de notificaciones (default 5)" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "send_notification",
    description: "Envía un mensaje de notificación al usuario via Telegram",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "ID del dispositivo/usuario" },
        message: { type: "string", description: "Texto del mensaje a enviar" },
      },
      required: ["device_id", "message"],
    },
  },
]

function getHardcodedChatContext(deviceId: string, limit: number): string {
  const messages: Record<string, string[]> = {
    "default": [
      `[09:15] Usuario: Hoy tuve un día pesado en el trabajo`,
      `[09:15] Bot: ¿Qué pasó? Cuéntame`,
      `[09:16] Usuario: Muchas reuniones y una entrega importante. Necesito desconectar`,
      `[09:16] Usuario: ¿Tienes música para relajarme?`,
    ],
    "alex-2": [
      `[18:00] Usuario: ¡Hoy es viernes! Ganas de fiesta`,
      `[18:00] Bot: Suena bien. ¿Qué plans?`,
      `[18:01] Usuario: Salir con amigos, necesito música alegre`,
    ],
    "maria-3": [
      `[14:00] Usuario: Estoy estudiando para un examen y me distraigo fácilmente`,
    ],
  }
  const chat = messages[deviceId] || messages["default"] || []
  return chat.slice(-limit).join("\n")
}

function getHardcodedNotifications(deviceId: string): string {
  const notifications: Record<string, string[]> = {
    "default": [
      `[Alta] Recordatorio: Revisión de sprint — Reunión en 30 minutos (calendar)`,
      `[Baja] 18°C en Arequipa, cielo despejado (weather)`,
    ],
    "alex-2": [
      `[Alta] Mensaje de grupo Amigos: Nos vemos a las 9 en La Plaza (telegram)`,
    ],
    "maria-3": [
      `[Urgente] Examen final mañana a las 8am (calendar)`,
    ],
  }
  return (notifications[deviceId] || []).join("\n")
}

function getHardcodedUserInfo(deviceId: string): string {
  const profiles: Record<string, string> = {
    "default": `Nombre: Alex\nZona horaria: America/Lima\nTelegram ID: 123456789\nGustos musicales: Radiohead, rock alternativo, música latina`,
    "alex-2": `Nombre: Alex\nZona horaria: America/Lima\nTelegram ID: 123456789\nGustos musicales: Daft Punk, electrónica, Bad Bunny`,
    "maria-3": `Nombre: María\nZona horaria: America/Mexico_City\nGustos musicales: Lo-fi, música clásica, Hans Zimmer`,
  }
  return profiles[deviceId] || profiles["default"] || "Usuario desconocido"
}

let mcpReqId = 0

function handleMcpRequest(body: JsonRpcMessage): JsonRpcMessage {
  mcpReqId++
  const id = body.id ?? mcpReqId

  if (body.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "flit-telegram-mcp", version: "1.0.0" },
      },
    }
  }

  if (body.method === "notifications/initialized") {
    return { jsonrpc: "2.0", id: undefined }
  }

  if (body.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } }
  }

  if (body.method === "tools/call") {
    const args = (body.params?.arguments || {}) as Record<string, string | number>
    const toolName = body.params?.name as string

    try {
      let resultText = ""
      switch (toolName) {
        case "get_chat_context": {
          const deviceId = String(args.device_id || "")
          const limit = Number(args.limit || 10)
          resultText = getHardcodedChatContext(deviceId, limit)
          break
        }
        case "get_chat_summary_today": {
          const deviceId = String(args.device_id || "")
          const chat = getHardcodedChatContext(deviceId, 20)
          resultText = `Resumen de conversaciones de hoy:\n${chat || "No hay conversaciones registradas"}`
          break
        }
        case "get_user_info": {
          const deviceId = String(args.device_id || "")
          resultText = getHardcodedUserInfo(deviceId)
          break
        }
        case "get_user_notifications": {
          const deviceId = String(args.device_id || "")
          resultText = getHardcodedNotifications(deviceId)
          break
        }
        case "send_notification": {
          const deviceId = String(args.device_id || "")
          const message = String(args.message || "")
          resultText = `Notificación enviada a ${deviceId}: "${message}"`
          break
        }
        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Tool not found: ${toolName}` },
          }
      }
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: resultText }] },
      }
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err instanceof Error ? err.message : "Internal error" },
      }
    }
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${body.method}` } }
}

function startMcpServer(): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === "POST") {
      let body = ""
      for await (const chunk of req) body += chunk
      try {
        const json = JSON.parse(body) as JsonRpcMessage
        const response = handleMcpRequest(json)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify(response))
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }))
      }
      return
    }

    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
  })

  server.listen(MCP_PORT, () => {
    console.log(`📡 MCP server listening on port ${MCP_PORT}`)
    console.log(`   Connect URL: http://localhost:${MCP_PORT}`)
  })
}

startMcpServer()

bot.start({ onStart: () => console.log(`🤖 Telegram bot started on port ${BOT_PORT}`) })
