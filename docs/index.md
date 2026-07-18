# FLIT · disco — Documentación completa

Aplicación web de sala de música colaborativa con **quiz de estado de ánimo** como experiencia principal, más votación de canciones, códigos QR y ubicación compartida como funciones secundarias. Creada para el hackathon **FLIT 2026**.

---

## Índice

1. [Resumen del proyecto](#1-resumen-del-proyecto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Arquitectura de la aplicación](#4-arquitectura-de-la-aplicación)
5. [Autores](#5-autores)
6. [Flujo de uso](#6-flujo-de-uso)
7. [Mood Quiz: componente principal](#7-mood-quiz-componente-principal)
8. [Supabase: configuración local + Cloudflare Tunnel](#8-supabase-configuración-local--cloudflare-tunnel)
9. [Base de datos: esquema completo](#9-base-de-datos-esquema-completo)
10. [Edge Functions](#10-edge-functions)
11. [Frontend: componentes y rutas](#11-frontend-componentes-y-rutas)
12. [Cómo ejecutar el proyecto](#12-cómo-ejecutar-el-proyecto)
13. [Incidencias conocidas](#13-incidencias-conocidas)
14. [Guía de migraciones](#14-guía-de-migraciones)
15. [Código muerto / no utilizado](#15-código-muerto--no-utilizado)

---

## 1. Resumen del proyecto

FLIT · disco ofrece dos experiencias:

### Experiencia principal: Mood Quiz
Al escanear un código QR (o al unirse a una sala), el usuario es recibido por un **quiz de 4 preguntas** que evalúa su estado de ánimo. La primera pregunta es un slider visual:

> **"¿Cómo te sientes hoy?"**

El usuario arrastra un control deslizante de 0 a 10, con emojis animados que reflejan su estado (😢 → 😄). El fondo cambia gradualmente de color (azul triste → violeta → rosado → naranja → dorado increíble) creando una experiencia "vibe". Las siguientes 3 preguntas serán generadas dinámicamente por una LLM para obtener más contexto emocional, y luego se recomendarán canciones que coincidan con el estado de ánimo (futuro).

### Funciones secundarias
- **Salas colaborativas**: Un anfitrión genera un código QR, los invitados escanean y se unen a una sala.
- **Votación de canciones**: Todos pueden buscar canciones (MusicBrainz) y votar por ellas en tiempo real via Realtime.
- **Ubicación compartida**: El anfitrión puede fijar una ubicación en un mapa para que los invitados sepan dónde dirigirse.
- **Ranking local**: Página `/songs` con 7 canciones precargadas y votación en localStorage (oculta en la UI).

---

## 2. Stack tecnológico

### Frontend

| Tecnología | Versión | Propósito |
|---|---|---|
| React | 19.2.7 | UI |
| React Router DOM | 7.18.1 | Enrutamiento |
| Vite | 8.1.1 | Build tool / dev server |
| Leaflet | 1.9.4 | Mapas interactivos |
| Protomaps-Leaflet | 5.1.0 | Capa de teselas vectoriales |
| QRCode | 1.5.4 | Generación de códigos QR |
| Supabase JS | 2.110.7 | Cliente Supabase (REST + Realtime) |

### Backend (Supabase)

| Componente | Detalle |
|---|---|
| Base de datos | PostgreSQL 17 (local, puerto 54322) |
| API | PostgREST (local, puerto 54321) |
| Edge Functions | Deno 2 (6 funciones) |
| Realtime | WebSockets (tabla `room_votes` publicada) |
| Auth | JWT 1 hora, signups habilitados, confirmaciones de email deshabilitadas |

### DevOps / Infraestructura

| Componente | Detalle |
|---|---|
| Supabase CLI | v2.109.1 |
| Cloudflare Tunnel | Expone Supabase local tras `flit-api.qallariy.lat` |
| Servidor de desarrollo | Vite en `0.0.0.0:3030`, acepta `flit-react.qallariy.lat` |

### APIs externas

| API | URL | Propósito |
|---|---|---|
| MusicBrainz | `https://musicbrainz.org/ws/2` | Búsqueda de canciones |
| Cover Art Archive | `https://coverartarchive.org/release` | Portadas de discos |
| Teselas (propio) | `https://tiles.qallariy.lat/20260603/{z}/{x}/{y}.mvt` | Mapas vectoriales con sabor `dark` |

---

## 3. Estructura del repositorio

```
/
├── index.html                      # Entrada HTML
├── package.json                    # Dependencias npm
├── vite.config.js                  # Configuración Vite
├── .oxlintrc.json                  # Linter config
├── .gitignore
├── README.md
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── main.jsx                    # Entry point (BrowserRouter + ErrorBoundary)
│   ├── App.jsx                     # Rutas de la aplicación
│   ├── App.css                     # Estilos principales (1024 líneas)
│   ├── index.css                   # Variables CSS globales + reset
│   ├── supabase.js                 # Cliente Supabase
│   │
│   └── components/
│       ├── HostPage.jsx            # Página del anfitrión (ruta /)
│       ├── ScanPage.jsx            # Página del invitado (ruta /qr/:hash)
│       ├── MoodSlider.jsx          # Slider de estado de ánimo (paso 1 del quiz)
│       ├── QuestionPlaceholder.jsx # Placeholder para pregunta 2 del quiz
│       ├── LocationPicker.jsx      # Selector de ubicación en mapa (pantalla completa)
│       ├── MiniMap.jsx             # Mapa miniatura no interactivo
│       ├── ErrorBoundary.jsx       # Capturador de errores React
│       │
│       ├── hooks/
│       │   ├── useRoomSongs.js     # Hook principal: votación vía Supabase + Realtime
│       │   ├── useSongs.js         # Hook: resuelve canciones via MusicBrainz/CoverArt (para SongsPage)
│       │   └── useSongVotes.js     # Hook: votación local (localStorage, para SongsPage)
│       │
│       ├── pages/
│       │   └── SongsPage.jsx       # Página de ranking de canciones (ruta /songs, oculta en la UI)
│       │
│       ├── data/
│       │   └── initialSongs.js     # Catálogo de 7 canciones precargadas
│       │
│       ├── services/
│       │   ├── coverart.js         # Cliente CoverArtArchive
│       │   ├── musicbrainz.jsx     # Cliente MusicBrainz
│       │   └── songVotes.js        # Lógica localStorage de votos
│       │
│       ├── SongCard.jsx            # Componente de tarjeta de canción individual
│       ├── SongList.jsx            # Lista de SongCards
│       │
│       ├── DiscoHome.jsx           # ⚠️ NO USADO - componente placeholder abandonado
│       └── LogIn.css               # ⚠️ NO USADO - estilos Miami-Vice para login
│
├── supabase/
│   ├── config.toml                 # Configuración del proyecto Supabase
│   ├── .gitignore
│   ├── .branches/_current_branch   # Rama actual (main)
│   │
│   ├── migrations/                 # Migraciones SQL (orden cronológico, 12 archivos)
│   │   ├── 20260718155643_create_qr_codes.sql
│   │   ├── 20260718161353_add_room_participants.sql
│   │   ├── 20260718171949_add_location_columns.sql
│   │   ├── 20260718182000_add_room_votes.sql
│   │   ├── 20260718183000_grant_service_role_permissions.sql
│   │   ├── 20260718184000_add_music_relations.sql
│   │   ├── 20260718184100_add_music_preferences.sql
│   │   ├── 20260718184200_add_room_track_candidates.sql
│   │   ├── 20260718184300_add_room_music_exclusions.sql
│   │   ├── 20260718184400_add_room_track_history.sql
│   │   ├── 20260718184500_add_participant_candidate_scores.sql
│   │   └── 20260718184600_grant_permissions_new_tables.sql
│   │
│   ├── functions/                  # 6 Edge Functions
│   │   ├── generate-qr/
│   │   ├── join-room/
│   │   ├── get-room/
│   │   ├── search-songs/
│   │   ├── set-location/
│   │   └── get-location/
│   │
│   └── snippets/                   # Vacío
│
├── dist/                           # Build de producción
│   ├── assets/
│   │   ├── index-BGSuaS0X.css
│   │   └── index-JQ3M2UHR.js
│   ├── favicon.svg
│   ├── icons.svg
│   └── index.html
│
└── docs/
    └── index.md                    # Este archivo
```

---

## 4. Arquitectura de la aplicación

```
┌────────────────────────────────────────────────────────────┐
│                      Navegador                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Vite Dev Server (0.0.0.0:3030)  ←─── Cloudflare    │  │
│  │  o dist/ (producción)           Tunnel ─── HTTP/2   │  │
│  │                          flit-react.qallariy.lat     │  │
│  └──────────┬───────────────────────────────────────────┘  │
│             │                                              │
│    ┌────────┴────────┐                                    │
│    │   React App     │                                    │
│    │  (BrowserRouter)│                                    │
│    └────────┬────────┘                                    │
│             │                                              │
│    ┌────────┴────────┐                                    │
│    │   Supabase JS   │──────────── HTTPS ────────────┐    │
│    │   Client        │                                │    │
│    └─────────────────┘                                │    │
└───────────────────────────────────────────────────────┘    │
                                                              │
         ┌────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Tunnel (flit-api.qallariy.lat → localhost:54321)│
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Supabase local                                        ││
│  │  ┌─────────────────────────────────────────────────┐   ││
│  │  │  PostgREST API (puerto 54321)                  │   ││
│  │  │  ├── REST /rest/v1/ (tablas)                   │   ││
│  │  │  ├── Realtime WebSocket                        │   ││
│  │  │  └── Edge Functions (Deno)                     │   ││
│  │  └─────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────┐   ││
│  │  │  PostgreSQL 17 (puerto 54322)                   │   ││
│  │  │  ├── qr_codes                                   │   ││
│  │  │  ├── room_participants                          │   ││
│  │  │  └── room_votes                                 │   ││
│  │  └─────────────────────────────────────────────────┘   ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

La aplicación React se comunica con Supabase (local) a través de un **Cloudflare Tunnel** que expone `localhost:54321` como `https://flit-api.qallariy.lat`. Las Edge Functions y las consultas directas a tablas (REST + Realtime) viajan por este túnel.

---

## 5. Autores

| Autor | Email | Commits | Principales contribuciones |
|---|---|---|---|
| **DaereanLegrand** | frankrogerstg@gmail.com | 9 | Estructura inicial, QR, salas, ubicación, mapa, búsqueda de canciones, mood quiz, slider |
| **rcayroc02** | roberto.cayro@ucsp.edu.pe | 3 | Conexión básica con MusicBrainz, lista dinámica, LogIn básico |

Commits totales: **12** (todos del 2026-07-18).

### Historial de commits

```
f13af31  DaereanLegrand  mood quiz: custom slider with dynamic background glow, spanish text, mobile-friendly
fe026c9  DaereanLegrand  docs: documentacion completa + migraciones para 6 tablas faltantes
e0828f5  DaereanLegrand  location picker with tiles.qallariy.lat + MiniMap
2980ec3  rcayroc02       lista dinamica
bca387b  DaereanLegrand  room: search songs via MusicBrainz + soft glow button
19ac9c8  DaereanLegrand  persist nickname in localStorage
9a465cb  rcayroc02       conexion basica con music brainz
6ad4bf1  DaereanLegrand  Empezar
c2993cb  DaereanLegrand  Initial commit again
29f79ef  rcayroc02       LogIn basico - screen
8742ebc  DaereanLegrand  personal finance dashboard with routing and credits page
56fb76c  DaereanLegrand  Initial commit
```

---

## 6. Flujo de uso

### Anfitrión (`/`)
1. Abre la app → ve el título "EMPEZAR"
2. Hace clic → se invoca `generate-qr` → se genera un hash aleatorio de 16 caracteres
3. Se muestra el código QR con la URL `https://<dominio>/qr/<hash>`
4. Cada 2 segundos se consulta `get-room` para actualizar la lista de participantes
5. Aparecen botones para:
   - **Agregar canción**: abre buscador (MusicBrainz), permite agregar canciones a `room_votes`
   - **Quedar lugar**: abre `LocationPicker` para fijar ubicación en el mapa
6. Las canciones más votadas aparecen en "Top votadas" con sus contadores en vivo (Realtime)

### Invitado (`/qr/:hash`)
1. Escanea el código QR → llega al formulario de nickname
2. Ingresa su nombre → llama `join-room` con `qr_hash`, `device_id`, `nickname`
3. Por 1.5 segundos ve un check animado, luego entra al **mood quiz**
4. **Paso 1**: Slider "¿Cómo te sientes hoy?" (0-10, colores dinámicos, emoji animado)
5. **Paso 2**: Placeholder para pregunta generada por LLM (futuro)
6. Luego de completar el quiz, entra a la sala
7. Ve la lista de participantes, el mapa de ubicación (si el anfitrión lo fijó)
8. Puede buscar canciones y votar por ellas
9. Las actualizaciones de votos llegan en tiempo real via Realtime

### Página de canciones (`/songs`)
- Accesible solo navegando manualmente a `/songs`
- Muestra un ranking de 7 canciones precargadas (votación local, no compartida)

---

## 7. Mood Quiz: componente principal

### MoodSlider (`src/components/MoodSlider.jsx`)

Componente de pantalla completa que presenta la pregunta principal del quiz. Es la primera interacción del usuario después de unirse a una sala.

#### Comportamiento

- **Slider**: Control deslizante de 0 a 10 implementado con un `div` personalizado y eventos `pointer` (no usa `<input type="range">` nativo para evitar problemas de límites en mobile).
- **Colores dinámicos**: El fondo (`mood-bg`) cambia gradualmente a través de un espectro de 11 colores:
  - 0-1: Azul (`#1565C0`) — tristeza
  - 2-3: Azul/violeta → Púrpura
  - 4-5: Magenta → Rosado (`#ff2d78`)
  - 6-7: Rosado → Naranja
  - 8-9: Naranja → Amarillo
  - 10: Dorado (`#FFD700`) — increíble
- **Transición**: El `background-color` cambia con `transition: 0.8s ease` (los gradientes radiales no son interpolables entre navegadores, por lo que se usa `background-color` + un pseudo-elemento con vignette fijo).
- **Emoji**: Aparece debajo del slider, animado con efecto `pop` (escala) cada vez que cambia el valor.
- **Etiquetas**: 6 labels debajo del slider: "terrible", "mal", "regular", "bien", "muy bien", "increíble". La activa se ilumina con el color del acento.
- **Pista**: Barra blanca semitransparente (`rgba(255,255,255,0.5)`) para alto contraste.
- **Pulgar**: Círculo de 28px con el color del acento y sombra glow.
- **Progreso**: 4 puntos indicadores (paso 1 de 4).
- **Botón**: "Continuar" con estilo outline (texto rosado, borde rosado, fondo transparente, sin bordes redondeados).
- **Touch**: Altura de 44px en el track para buena experiencia táctil en mobile.

#### Implementación técnica

```jsx
// Eventos pointer en el track
onPointerDown → setDragging(true), setFromEvent(clientX)
onPointerMove → if dragging, setFromEvent(clientX)
onPointerUp → setDragging(false)

// Cálculo de valor
setFromEvent(clientX) {
  const rect = trackRef.current.getBoundingClientRect()
  const x = clamp(clientX - rect.left, 0, rect.width)
  const value = round((x / rect.width) * 10)
  setValue(value)
}
```

### QuestionPlaceholder (`src/components/QuestionPlaceholder.jsx`)

Componente placeholder para la segunda pregunta del quiz. Muestra:
- Título "Pregunta 2"
- Indicador "(próximamente)"
- 4 puntos de progreso (paso 2 activo)
- Botón "Ir a la sala"

Este componente será reemplazado por preguntas generadas dinámicamente por una LLM en una versión futura.

### Integración en ScanPage

El flujo dentro de `ScanPage.jsx` tiene 4 fases (controladas por el estado `phase`):

```
form → joining (1.5s) → quiz → room
```

Dentro de `quiz`, hay 2 pasos controlados por `quizStep`:

```
quizStep 1 → <MoodSlider onComplete={...} />
quizStep 2 → <QuestionPlaceholder onComplete={...} />
```

El valor del mood (`0-10`) se almacena en `_moodValue` para uso futuro en recomendaciones.

### CSS

Los estilos del mood quiz ocupan aproximadamente 175 líneas en `src/App.css` (líneas 851-1024). Incluyen:

| Selector | Propósito |
|---|---|
| `.mood-slider` | Contenedor full-screen, flexbox centrado |
| `.mood-bg` | Capa de fondo con `background-color` transicionable |
| `.mood-bg::after` | Vignette radial fijo (transparente → negro) |
| `.mood-card` | Tarjeta de contenido (max-width: 460px) |
| `.mood-heading` | Título en Playfair Display con glow |
| `.mood-track-area` | Contenedor del slider |
| `.mood-track` | Track touch target (44px) |
| `.mood-track-bg` | Barra blanca semitransparente |
| `.mood-thumb` | Pulgar circular con glow, posicionado con `left: X%` |
| `.mood-labels-row` | Fila de 6 etiquetas de ánimo |
| `.mood-label--on` | Etiqueta activa con color del acento |
| `.mood-current-emoji` | Emoji grande animado con `mood-pop` |
| `.mood-steps` / `.mood-dot` | Indicadores de progreso |
| `.mood-btn` | Botón outline (estático, rosado fijo) |

---

## 8. Supabase: configuración local + Cloudflare Tunnel

### Infraestructura

Supabase se ejecuta **localmente** en la máquina de desarrollo usando `supabase start`. No hay instancia cloud de Supabase. Para exponer los servicios localhost a internet, se utiliza un **Cloudflare Tunnel**.

| Servicio local | Puerto | Expuesto como |
|---|---|---|
| Supabase API | `localhost:54321` | `https://flit-api.qallariy.lat` |
| Supabase DB (PostgreSQL) | `localhost:54322` | No expuesto directamente |
| Supabase Studio | `localhost:54323` | No expuesto |
| Vite dev server | `localhost:3030` | (externo, no documentado) |

### Referencias en el código

- **`src/supabase.js`**: `supabaseUrl = 'https://flit-api.qallariy.lat'`
- **`vite.config.js`**: `allowedHosts: ['flit-react.qallariy.lat']`
- **MiniMap.jsx / LocationPicker.jsx**: `url: 'https://tiles.qallariy.lat/20260603/{z}/{x}/{y}.mvt'`

### Cómo funciona

El Cloudflare Tunnel se configura externamente (no hay archivos de configuración en este repositorio). El comando típico para crearlo sería:

```bash
cloudflared tunnel create flit-api
cloudflared tunnel route dns flit-api flit-api.qallariy.lat
cloudflared tunnel run flit-api
```

Que redirige `https://flit-api.qallariy.lat/*` → `http://localhost:54321/*`.

### Túnel de teselas de mapa

Las teselas vectoriales se sirven desde `tiles.qallariy.lat`, también presumiblemente a través de Cloudflare Tunnel u otro mecanismo externo.

---

## 9. Base de datos: esquema completo

La base de datos tiene **9 tablas** en total. De ellas, 3 fueron creadas mediante migraciones y 6 fueron creadas manualmente por otros autores y posteriormente migradas a archivos SQL (ver [incidencias conocidas](#13-incidencias-conocidas)).

### 9.1 Tablas base

#### `qr_codes` — Códigos QR de salas

```sql
create table if not exists qr_codes (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  lat double precision,         -- agregado en migración 3
  lng double precision,         -- agregado en migración 3
  created_at timestamptz not null default now()
);
```

RLS habilitado con políticas de insert y select para `anon`, `authenticated`.

#### `room_participants` — Participantes de una sala

```sql
create table if not exists room_participants (
  id uuid primary key default gen_random_uuid(),
  qr_hash text not null references qr_codes(hash),
  device_id text not null,
  nickname text,
  created_at timestamptz not null default now(),
  unique(qr_hash, device_id)
);
```

RLS habilitado con políticas de insert y select para `anon`, `authenticated`.

#### `room_votes` — Votos de canciones (usado por la app actual)

```sql
create table if not exists room_votes (
  id uuid primary key default gen_random_uuid(),
  qr_hash text not null references qr_codes(hash),
  device_id text not null,
  title text not null,
  artist text not null,
  cover_url text,
  created_at timestamptz not null default now(),
  unique(qr_hash, device_id, title, artist)
);
```

RLS habilitado. Incluida en `supabase_realtime` para actualizaciones en vivo.

---

### 9.2 Tablas de recomendación musical

Estas tablas conforman un **sistema de recomendación de canciones** por sala. Almacenan preferencias de participantes, relaciones entre artistas/géneros/canciones, y candidatos sugeridos para reproducción. Creadas para integración futura con el mood quiz.

#### `music_relations` — Relaciones semánticas entre música

```sql
create table if not exists music_relations (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,        -- 'genre', 'artist', o 'track'
  source_key text not null,         -- identificador de la fuente
  target_kind text not null,        -- 'genre', 'artist', o 'track'
  target_key text not null,         -- identificador del objetivo
  target_name text not null,        -- nombre legible del objetivo
  target_artist text,               -- artista (si target es track)
  similarity numeric(7,6) not null, -- 0.000000 a 1.000000
  provider text not null default 'lastfm',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + '7 days'::interval,
  unique(source_kind, source_key, target_kind, target_key, provider)
);
```

Almacena relaciones de similitud entre géneros, artistas y canciones. Sin RLS.

#### `music_preferences` — Preferencias musicales de participantes

```sql
create table if not exists music_preferences (
  id uuid primary key default gen_random_uuid(),
  room_hash text not null references qr_codes(hash) on delete cascade,
  participant_id uuid not null references room_participants(id) on delete cascade,
  kind text not null,              -- 'genre', 'artist', o 'track'
  name text not null,              -- nombre de la preferencia
  artist text,                     -- artista asociado (si kind='track')
  mbid text,                       -- MusicBrainz ID
  canonical_key text not null,     -- clave normalizada para joins
  weight numeric(5,4) not null default 0.7,  -- peso de la preferencia (0-1)
  source text not null default 'manual',     -- 'manual' o 'lastfm'
  created_at timestamptz not null default now(),
  unique(participant_id, kind, canonical_key)
);
```

Cada participante puede tener preferencias con peso asignado. Sin RLS.

---

### 9.3 Tablas de candidatos y reproducción

#### `room_track_candidates` — Canciones candidatas para una sala

Canciones sugeridas o descubiertas para una sala, con metadatos. Sin RLS.

#### `participant_candidate_scores` — Puntajes de candidatos por participante

Puntajes calculados para cada par participante-candidato, basados en preferencias, relaciones y exclusiones. Sin RLS.

#### `room_music_exclusions` — Exclusiones musicales por sala/participante

Canciones o artistas que no deben ser sugeridos. Sin RLS.

#### `room_track_history` — Historial de reproducción

Registro de lo que se propuso, aprobó, reprodujo o saltó en cada sala. Sin RLS.

---

### 9.4 Permisos

| Tabla | anon | authenticated | service_role | RLS |
|---|---|---|---|---|
| `qr_codes` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ✅ |
| `room_participants` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ✅ |
| `room_votes` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ✅ |
| `music_preferences` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ❌ |
| `music_relations` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ❌ |
| `participant_candidate_scores` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ❌ |
| `room_music_exclusions` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ❌ |
| `room_track_candidates` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ❌ |
| `room_track_history` | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ❌ |

**Nota:** Las 6 tablas nuevas tienen RLS habilitado en las migraciones pero **sin políticas definidas en la BD actual** (fueron creadas antes de las migraciones). Las migraciones incluyen políticas que deben aplicarse con `supabase db push`.

---

### 9.5 Diagrama ER completo

```
qr_codes (1) ────────── (N) room_participants
    │                          (por qr_hash)
    │                          │
    │                          │ (participant_id)
    │                          ▼
    │               ┌─────────────────────┐
    │               │  music_preferences  │── kind: genre/artist/track
    │               └─────────────────────┘
    │
    │ (room_hash)   ┌─────────────────────┐
    ├──────────────►│ room_music_exclusions│── track_key / artist_key
    │               └─────────────────────┘
    │
    │ (room_hash)   ┌──────────────────────┐
    ├──────────────►│ room_track_candidates │── seed_source, track_key
    │               └──────────┬───────────┘
    │                          │
    │               ┌──────────▼───────────┐
    │               │participant_candidate_│
    │               │      scores          │── score, reasons (jsonb)
    │               └──────────────────────┘
    │
    │ (room_hash)   ┌──────────────────────┐
    ├──────────────►│  room_track_history   │── status
    │               └──────────────────────┘
    │
    │ (room_hash)   ┌──────────────┐
    └──────────────►│  room_votes   │── título, artista, device_id
                    └──────────────┘

                    ┌──────────────────┐
                    │ music_relations  │── source/target kinds (sin FK a salas)
                    └──────────────────┘
```

---

## 10. Edge Functions

Todas las funciones usan `@supabase/server` con `withSupabase({ auth: ["publishable", "secret"] })` y `verify_jwt = false`. Esto significa que aceptan tanto el anon key como el service role key sin verificar JWT.

| Función | Ruta | Método | Body | Respuesta |
|---|---|---|---|---|
| **generate-qr** | `/functions/v1/generate-qr` | POST | (vacio) | `{ id, hash, created_at }` |
| **join-room** | `/functions/v1/join-room` | POST | `{ qr_hash, device_id, nickname }` | `{ id, nickname, created_at }` |
| **get-room** | `/functions/v1/get-room` | POST | `{ qr_hash }` | `{ participants: [...], count }` |
| **search-songs** | `/functions/v1/search-songs` | POST | `{ q }` | `{ results: [...] }` |
| **set-location** | `/functions/v1/set-location` | POST | `{ hash, lat, lng }` | `{ lat, lng }` |
| **get-location** | `/functions/v1/get-location` | POST | `{ hash }` | `{ lat, lng }` |

### Funciones planeadas (futuro mood quiz)

| Función | Propósito |
|---|---|
| **mood-questions** | Toma `{ mood_value }` (0-10), llama a una LLM para generar 3 preguntas de seguimiento personalizadas |
| **mood-recommend** | Toma `{ mood_value, answers }`, llama a LLM para obtener recomendaciones de canciones, verifica con Last.fm |

Todas tienen import map idéntico:

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@^2",
    "@supabase/server": "npm:@supabase/server@^1"
  }
}
```

---

## 11. Frontend: componentes y rutas

### Rutas definidas en `App.jsx`

```jsx
<Route path="/" element={<HostPage />} />
<Route path="/qr/:hash" element={<ScanPage />} />
<Route path="/songs" element={<SongsPage />} />
```

### Árbol de componentes

```
<ErrorBoundary>                     ← envuelve toda la app
  <BrowserRouter>
    <App>
      ├── "/" → <HostPage>
      │           ├── <QRCode> (imagen generada)
      │           ├── <MiniMap> (si hay ubicación)
      │           └── <LocationPicker> (al elegir ubicación)
      │
      ├── "/qr/:hash" → <ScanPage>
      │           ├── <form> (nickname)
      │           ├── <MoodSlider> (quiz paso 1)
      │           ├── <QuestionPlaceholder> (quiz paso 2)
      │           ├── <MiniMap> (si el host puso ubicación)
      │           └── <div participantes>
      │
      └── "/songs" → <SongsPage>    ← sin enlace en la UI
                        ├── <SongList>
                        │     └── <SongCard>
                        └── (usa useSongs + useSongVotes)
```

### Flujo de fases en ScanPage

```
useState('phase')  → 'form' | 'joining' | 'quiz' | 'room'
useState('quizStep') → 1 | 2

form  →  (submit nickname)  →  joining  →  (1.5s)  →  quiz  →  (completar)  →  room
                                                                                  │
                                                                           fetchRoom cada 2s
                                                                           get-location
                                                                           useRoomSongs
```

---

## 12. Cómo ejecutar el proyecto

### Requisitos

- Node.js 20+
- npm
- Supabase CLI (`brew install supabase` o `npm i -g supabase`)
- Cloudflare CLI (`brew install cloudflare/cloudflare/cloudflared`) — solo para exponer

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Supabase local
supabase start

# 3. Ejecutar migraciones (si no se aplicaron automáticamente)
supabase db push

# 4. Iniciar servidor de desarrollo Vite
npm run dev

# 5. (Opcional) Exponer Supabase via Cloudflare Tunnel
cloudflared tunnel run flit-api
```

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en `0.0.0.0:3030` |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Previsualizar build |
| `npm run lint` | Oxlint |
| `supabase start` | Inicia Supabase local |
| `supabase stop` | Detiene Supabase local |
| `supabase status` | Estado de servicios locales |
| `supabase db push` | Aplica migraciones pendientes |
| `supabase db reset` | Resetea BD y aplica migraciones desde cero |
| `supabase functions serve` | Sirve funciones localmente para desarrollo |

### Nota sobre el seed

El archivo `config.toml` referencia `./seed.sql` pero **el archivo no existe**. Si se ejecuta `supabase db reset`, fallará. Para evitarlo, deshabilitar el seed en `config.toml`:

```toml
[db.seed]
enabled = false
```

O crear el archivo `supabase/seed.sql` con contenido apropiado (puede estar vacío inicialmente).

---

## 13. Incidencias conocidas

### 13.1 Tablas faltantes por migraciones incompletas

Debido a que han trabajado **varios autores** en este proyecto, puede que la base de datos local no tenga todas las tablas necesarias.

**Síntomas:**
- Error al hacer clic en "EMPEZAR": `relation "qr_codes" does not exist`
- Error al unirse a una sala: `relation "room_participants" does not exist`
- Error al votar: `relation "room_votes" does not exist`
- Error en funciones: `relation "xxxx" does not exist`

**Solución:** Ejecutar `supabase db push` para aplicar las migraciones pendientes. Ver [Guía de migraciones](#14-guía-de-migraciones).

### 13.2 seed.sql faltante

`config.toml` referencia `./seed.sql` que no existe. Causa error en `supabase db reset`. Solución: deshabilitarlo o crearlo.

### 13.3 Tablas creadas por otros autores que no existen en migraciones (RESUELTO)

> **Estado actual:** RESUELTO. Se crearon migraciones para las 6 tablas faltantes (`20260718184000` a `20260718184600`). Ver sección 9 para el detalle completo.

**Problema histórico:**

Si algún autor creó tablas manualmente (via SQL directo en Supabase Studio o consola), esos cambios no están versionados en `supabase/migrations/`. Esto ocurrió con 6 tablas en este proyecto y ya se resolvió creando las migraciones correspondientes. Para capturar futuros cambios no versionados:

```bash
supabase db diff --use-migra -f nombre_de_la_migracion
```

### 13.4 Puerto en uso

Si el puerto 54321 o 54322 están ocupados, cambiar en `config.toml`:

```toml
[api]
port = 54325

[db]
port = 54326
```

### 13.5 Página /songs no enlazada

La ruta `/songs` existe pero no tiene ningún enlace en la interfaz de usuario. Solo es accesible escribiendo la URL manualmente.

### 13.6 Mood quiz: preguntas 2-4 pendientes

Actualmente solo existe la pregunta 1 (slider de ánimo). Las preguntas 2, 3 y 4 son placeholders. La implementación completa requiere:
- Edge Functions `mood-questions` y `mood-recommend` con integración LLM
- Componente de preguntas de opción múltiple generadas dinámicamente
- Verificación de canciones via Last.fm
- Integración con playlist en `room_votes`

---

## 14. Guía de migraciones

### Aplicar migraciones pendientes

```bash
# Ver estado de las migraciones
supabase db diff

# Aplicar migraciones no ejecutadas
supabase db push
```

### Forzar reset completo de la BD

```bash
# ⚠️ Esto BORRA todos los datos
# Editar supabase/config.toml:
#   [db.seed]
#   enabled = false

supabase db reset
```

### Verificar qué migraciones se han aplicado

```bash
supabase db dump --local | grep -A5 supabase_migrations
```

O desde psql:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"
```

### Crear una nueva migración

```bash
supabase db diff --use-migra -f descripcion_de_la_migracion
```

### Orden cronológico de migraciones

| # | Archivo | Descripción |
|---|---|---|
| 1 | `20260718155643_create_qr_codes.sql` | Tabla `qr_codes` |
| 2 | `20260718161353_add_room_participants.sql` | Tabla `room_participants` + FK a `qr_codes` |
| 3 | `20260718171949_add_location_columns.sql` | Columnas `lat`/`lng` en `qr_codes` |
| 4 | `20260718182000_add_room_votes.sql` | Tabla `room_votes` + FK a `qr_codes` + publicación Realtime |
| 5 | `20260718183000_grant_service_role_permissions.sql` | Grants para `anon`, `authenticated`, `service_role` |
| 6 | `20260718184000_add_music_relations.sql` | Tabla `music_relations` + RLS + políticas |
| 7 | `20260718184100_add_music_preferences.sql` | Tabla `music_preferences` + FKs + RLS + políticas |
| 8 | `20260718184200_add_room_track_candidates.sql` | Tabla `room_track_candidates` + FK + RLS + políticas |
| 9 | `20260718184300_add_room_music_exclusions.sql` | Tabla `room_music_exclusions` + FKs + RLS + políticas |
| 10 | `20260718184400_add_room_track_history.sql` | Tabla `room_track_history` + FK + RLS + políticas |
| 11 | `20260718184500_add_participant_candidate_scores.sql` | Tabla `participant_candidate_scores` + FKs + RLS + políticas |
| 12 | `20260718184600_grant_permissions_new_tables.sql` | Grants para las 6 nuevas tablas |

---

## 15. Código muerto / no utilizado

Los siguientes archivos existen en el repositorio pero **no se utilizan** en la aplicación en ejecución:

| Archivo | Estado | Observación |
|---|---|---|
| `src/components/DiscoHome.jsx` | Muerto | Componente placeholder que ya no se importa. Borrar con seguridad. |
| `src/components/LogIn.css` | Muerto | 243 líneas de estilos Miami-Vice que nunca se importan. Borrar con seguridad. |
| `src/components/pages/SongsPage.jsx` | Isla huérfana | Ruta existe pero no hay enlace en la UI. Solo accesible manualmente. |
| `src/components/hooks/useSongs.js` | Isla huérfana | Solo usado por SongsPage. |
| `src/components/hooks/useSongVotes.js` | Isla huérfana | Solo usado por SongsPage. |
| `src/components/data/initialSongs.js` | Isla huérfana | Solo usado por SongsPage. |
| `src/components/services/coverart.js` | Isla huérfana | Solo usado por useSongs. |
| `src/components/services/musicbrainz.jsx` | Isla huérfana | Solo usado por useSongs. |
| `src/components/services/songVotes.js` | Isla huérfana | Solo usado por useSongVotes. |
| `src/components/SongList.jsx` | Isla huérfana | Solo usado por SongsPage. |
| `src/components/SongCard.jsx` | Isla huérfana | Solo usado por SongList. |

**Decisión:** Estos archivos se mantienen por ahora. Si se decide eliminar la función de ranking local `/songs`, se pueden borrar los 8 archivos de la isla más la ruta en `App.jsx`. Los componentes activos del mood quiz (`MoodSlider.jsx`, `QuestionPlaceholder.jsx`) están en pleno uso.
