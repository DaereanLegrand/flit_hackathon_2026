# Vibe Daily DJ Agent

Esta implementación ofrece dos accesos al mismo agente musical diario: el botón **MI VIBE DE HOY** de la pantalla principal abre `/daily-vibe`, y el cuestionario que ya existía después de unirse a una sala también continúa con preguntas del agente. Groq genera las preguntas y Last.fm aporta canciones reales.

## Qué se comparte por Git

- `supabase/migrations/20260718191000_create_daily_music_agent.sql`: crea tres tablas privadas, índices, restricciones, RLS y permisos exclusivos para `service_role`.
- `supabase/functions/daily-dj-agent/`: función Edge que valida la sesión, conversa con Groq, consulta Last.fm y persiste el resultado.
- `supabase/config.toml`: registra la función y carga los secretos desde el entorno del servidor.
- `src/components/QuestionPlaceholder.jsx`: reemplaza el placeholder de la segunda pregunta por el agente real.
- `src/components/ScanPage.jsx`: entrega al agente el valor seleccionado en `MoodSlider`.
- `src/components/DailyVibePage.jsx`: conserva el acceso individual desde el botón **MI VIBE DE HOY**.
- `supabase/.env.example`: nombres de variables, nunca claves reales.

No se comparte `supabase/.env.local`; está ignorado por Git.

## Flujo interno

1. El participante responde el `MoodSlider` existente al entrar a la sala.
2. `start` crea una sesión diaria, guarda ese estado de ánimo inicial y genera un token secreto.
3. Groq usa `ask_question` para formular las preguntas breves siguientes.
4. Cada `answer` se valida y se guarda antes de pedir la siguiente decisión al modelo.
5. Cuando hay señales suficientes, Groq usa `search_music` con tags y semillas. La función consulta `tag.getTopTracks`, `artist.getTopTracks` y, cuando corresponde, `track.getSimilar` de Last.fm.
6. Las canciones se normalizan, deduplican y guardan como candidatos reales.
7. Groq usa `choose_recommendation`, pero solo puede escoger IDs que Last.fm devolvió. Así se evita que el LLM invente títulos.
8. La canción y playlist se muestran en el mismo flujo y luego el participante continúa hacia la sala.

El endpoint acepta estas acciones mediante `POST /functions/v1/daily-dj-agent`:

```json
{ "action": "start", "device_id": "uuid-o-identificador-del-dispositivo", "initial_mood": 7 }
```

```json
{
  "action": "answer",
  "session_id": "uuid",
  "access_token": "uuid",
  "answer": "Quiero energía para entrenar"
}
```

También existen `status` con `session_id` y `access_token`, y `feedback` agregando `feedback: "liked" | "disliked" | "another"`.

## Instalación en el Supabase compartido

Estos pasos se ejecutan **en la computadora que aloja Supabase**, dentro de su copia del repositorio. No se usa `supabase link`, `supabase secrets set` ni un `project-ref`, porque esta instancia es autohospedada y administrada por Supabase CLI. Primero, los cambios de esta implementación deben estar confirmados y subidos al repositorio remoto.

Actualizar el código y crear el archivo secreto del servidor:

```bash
git pull
test -f supabase/.env.local || cp supabase/.env.example supabase/.env.local
chmod 600 supabase/.env.local
```

Editar `supabase/.env.local` y colocar una clave nueva de Groq y una API key de Last.fm. Luego cargarlas en la terminal sin imprimirlas:

```bash
set -a
source supabase/.env.local
set +a
```

Las variables deben cargarse antes de usar el CLI porque `config.toml` las referencia mediante `env()`. Después, hacer un backup y comprobar qué migraciones reconoce la instancia:

```bash
npx supabase status
npx supabase migration list --local
```

Aplicar únicamente las migraciones pendientes. No usar `db reset`, porque borraría y reconstruiría la base local:

```bash
npx supabase migration up --local
```

Para que el contenedor de Edge Runtime reciba las nuevas variables se debe recrear el stack. Esto provoca una interrupción breve del servidor:

```bash
npx supabase stop
set -a
source supabase/.env.local
set +a
npx supabase start
```

Si el servidor se administra con un `docker-compose.yml` propio y no con Supabase CLI, el equivalente es montar `supabase/functions` en Edge Runtime, declarar `GROQ_API_KEY` y `LASTFM_API_KEY` en el entorno de ese servicio, aplicar la migración con el usuario administrador y recrear solamente el contenedor de funciones.

## Prueba rápida desde otra laptop

Usar la URL pública real del API y su publishable key. El ejemplo no contiene secretos de Groq ni Last.fm:

```bash
curl 'https://flit-api.qallariy.lat/functions/v1/daily-dj-agent' \
  -H 'apikey: PUBLISHABLE_KEY' \
  -H 'Authorization: Bearer PUBLISHABLE_KEY' \
  -H 'Content-Type: application/json' \
  --data '{"action":"start","device_id":"test-agent-12345678"}'
```

La respuesta esperada tiene `type: "question"`, `session_id`, `access_token`, la pregunta y sus opciones. El token debe mantenerse privado y enviarse en los pasos siguientes.

La interfaz puede probarse desde el botón **MI VIBE DE HOY**, que abre `/daily-vibe`. También puede probarse creando una sala, abriendo su QR como participante y completando el slider **¿Cómo te sientes hoy?**; la siguiente pantalla ya no debe decir “próximamente”, sino mostrar una pregunta generada por el agente.

Actualizar Supabase despliega el backend, pero no publica por sí mismo el frontend. El servicio que aloja React también debe ejecutar su proceso habitual de build/despliegue después del `git pull` para que el cuestionario existente use el agente.

## Configuración y seguridad

- `GROQ_API_KEY` y `LASTFM_API_KEY` existen solo en Edge Runtime; nunca llegan al navegador.
- Las tres tablas tienen RLS sin políticas públicas y permisos revocados para `anon` y `authenticated`.
- El navegador solo conoce un token aleatorio de su propia sesión.
- Se permite una sesión por dispositivo y día UTC. El `device_id` limita accidentes, pero no sustituye autenticación ni un rate limiter de infraestructura frente a abuso deliberado.
- La función no reproduce música ni usa OAuth de Spotify/YouTube Music; solo crea enlaces de búsqueda.

## MCP Client — Consumo de servidores externos

El agente actúa como un **cliente MCP** (Model Context Protocol) para consumir servidores externos
que proveen contexto del usuario. La conexión se realiza al inicio de cada sesión.

### Servidores MCP disponibles

| Servidor | Propósito | Herramientas expuestas |
|---|---|---|
| `flit-telegram-mcp` (se ejecuta junto al bot de Telegram) | Chat reciente, perfil, notificaciones | `get_chat_context`, `get_chat_summary_today`, `get_user_info`, `get_user_notifications`, `send_notification` |
| Futuros: email, calendario, notificaciones push | Pendiente | Pendiente |

### Configuración

```bash
# En supabase/.env.local
MCP_SERVER_URLS=flit-telegram-mcp=http://localhost:3100
```

El formato de `MCP_SERVER_URLS` es: `nombre1=url1,nombre2=url2`

Las herramientas de cada servidor se fusionan con las herramientas locales de Groq.
El LLM decide si usar una herramienta local (`ask_question`, `search_music`, `choose_recommendation`)
o una herramienta MCP (prefijada con el nombre del servidor, ej. `flit-telegram-mcp__get_chat_context`).

### Hardcoded data

Para evitar depender de OAuth y API keys de terceros, los datos de usuario se proporcionan
mediante datos hardcodeados en `supabase/functions/daily-dj-agent/hardcoded_data.ts`.
Allí hay perfiles de ejemplo para distintos dispositivos con chat, notificaciones, calendario,
correos e historial de escucha. Cuando se conecten servicios reales (Spotify, Google Calendar,
Gmail), basta con reemplazar las funciones en `hardcoded_data.ts` por llamadas API reales.

### Flujo de datos

1. `handleStart` recibe `device_id`
2. Se conecta a los servidores MCP configurados en `MCP_SERVER_URLS`
3. Se obtiene el contexto hardcodeado para el `device_id`
4. El contexto (chat, notis, calendario, correos, historial) se inyecta en el prompt de Groq
5. Groq usa esta información para personalizar preguntas y recomendación
6. Groq puede llamar herramientas MCP durante la conversación si necesita más contexto

## Telegram Bot (servicio separado)

El bot de Telegram (`telegram-bot/`) opera como un **servicio independiente** que:

- Responde a comandos del usuario (`/start`, `/vibe`, `/tastes`)
- Almacena mensajes en `telegram_chat_context` vía Supabase REST
- Expone un servidor MCP en `http://localhost:3100` para que el `daily-dj-agent` consuma
- Usa datos hardcodeados en `getHardcodedChatContext`, `getHardcodedNotifications`, etc.

### Requisitos

```bash
cd telegram-bot
cp .env.example .env
# Editar .env con TELEGRAM_BOT_TOKEN y SUPABASE_ANON_KEY
npm install
npm run dev
```

### Comandos del bot

| Comando | Acción |
|---|---|
| `/start` | Bienvenida + teclado inline |
| `/vibe` | Inicia cuestionario de estado de ánimo → recomendación |
| `/tastes` | Muestra gustos musicales hardcodeados |
| Cualquier mensaje | Conversación básica + almacenamiento en DB |

### Conexión con el daily-dj-agent

El bot de Telegram se conecta con el agente Edge Function de dos formas:

1. **BD compartida**: El bot escribe en `telegram_chat_context` y `user_notifications`
2. **MCP Server**: El bot expone `get_chat_context`, `get_user_info`, etc. como herramientas MCP
   que el `daily-dj-agent` consume cuando se lo solicita Groq

## Tablas de datos de usuario

### `user_profiles`
Perfil de usuario vinculando `device_id` con datos de Telegram y zona horaria.

### `user_listening_history`
Historial de artistas, tracks y géneros que le gustan al usuario.
`source` indica si es hardcodeado, de Last.fm o de Spotify.

### `user_interactions`
Cada "me gusta" / "no me gusta" que el usuario da a una recomendación.
Se usa para construir el perfil de gusto a largo plazo.

### `telegram_chat_context`
Mensajes recientes del chat de Telegram para dar contexto al agente.

### `user_notifications`
Notificaciones de diversas fuentes (calendario, Telegram, sistema) que el agente
puede usar para entender el estado actual del usuario.

## Modelo de Groq

El valor predeterminado es `qwen/qwen3.6-27b`: fue probado con Responses API y devolvió correctamente una llamada local a `ask_question`. La conexión básica con `llama-3.3-70b-versatile` funcionó, pero su llamada de herramienta falló durante la validación y Groq anunció su retiro para el **16 de agosto de 2026**. `GROQ_MODEL` permite cambiar de modelo sin modificar la base de datos.

Referencias: [Responses API de Groq](https://console.groq.com/docs/responses-api), [tool calling local](https://console.groq.com/docs/tool-use/local-tool-calling), [retiro de modelos](https://console.groq.com/docs/deprecations) y [`tag.getTopTracks` de Last.fm](https://www.last.fm/api/show/tag.getTopTracks).
