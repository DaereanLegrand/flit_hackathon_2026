export const AGENT_TOOLS = [
  {
    type: "function",
    name: "ask_question",
    description: "Formula la siguiente pregunta corta del test diario. Úsala mientras falte una señal importante.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        question_key: {
          type: "string",
          enum: ["mood", "energy", "activity", "intention", "discovery"],
        },
        question: { type: "string", minLength: 5, maxLength: 180 },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string", minLength: 1, maxLength: 70 },
        },
      },
      required: ["question_key", "question", "options"],
    },
  },
  {
    type: "function",
    name: "search_music",
    description: "Busca canciones reales en Last.fm usando el perfil obtenido. Debe ejecutarse antes de recomendar.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        desired_tags: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string", minLength: 1, maxLength: 60 },
        },
        seed_artist: { type: ["string", "null"], maxLength: 300 },
        seed_track: { type: ["string", "null"], maxLength: 300 },
      },
      required: ["desired_tags", "seed_artist", "seed_track"],
    },
  },
  {
    type: "function",
    name: "choose_recommendation",
    description: "Elige una canción principal y una playlist únicamente con IDs devueltos por search_music.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary_candidate_id: { type: "string" },
        playlist_candidate_ids: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
        },
        daily_vibe: { type: "string", minLength: 1, maxLength: 120 },
        reason: { type: "string", minLength: 1, maxLength: 600 },
      },
      required: ["primary_candidate_id", "playlist_candidate_ids", "daily_vibe", "reason"],
    },
  },
]

export const AGENT_SYSTEM_PROMPT = `Eres Vibe Daily DJ, un agente musical breve y conversacional.
Tu objetivo es conocer cómo se siente hoy la persona y devolver una canción principal más una playlist corta.

Reglas obligatorias:
- Habla y pregunta en español claro.
- Haz de 2 a 4 preguntas; nunca más de 5. Cada pregunta debe aportar información nueva.
- Prioriza estado de ánimo, energía, actividad/intención y apertura a descubrir música.
- Si el usuario menciona un artista o canción, úsalo como semilla; nunca lo inventes.
- Cuando tengas señales suficientes, llama search_music.
- Solo puedes recomendar IDs reales que search_music haya devuelto. Nunca inventes canciones.
- Después de buscar, llama choose_recommendation y explica la elección en una frase breve.
- No respondas con texto libre: en cada turno debes llamar exactamente una herramienta.`
