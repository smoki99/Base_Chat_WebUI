# Architektur

## Überblick

```
┌────────────────────────────────────────────────────────────┐
│  apps/web (React 19 + Vite)                                │
│  – Holt Daten via fetch von der API                        │
│  – VITE_API_URL (aus .env) oder Vite-Proxy in dev          │
│  – Importiert Typen aus packages/shared                    │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTP / REST
                       ▼
┌────────────────────────────────────────────────────────────┐
│  apps/api (Express)                                        │
│  – src/routes/    → HTTP-Endpunkte (Routen, Validierung)   │
│  – src/services/  → Business-Logik (keine HTTP-Kenntnisse) │
│  – Importiert Typen aus packages/shared                    │
└──────────────────────┬─────────────────────────────────────┘
                       │ import
                       ▼
┌────────────────────────────────────────────────────────────┐
│  packages/shared                                           │
│  – ChatMessage, ApiResponse<T>, ApiError, ApiResult<T>   │
│  – Gemeinsame Typen & DTOs für alle Workspaces             │
│  – Keine eigenen Dependencies (reines TS)                  │
└────────────────────────────────────────────────────────────┘
```

## Gemeinsame Typen (`packages/shared`)

Alle Domänen-Typen und API-DTOs werden **einmalig** in `packages/shared/src/index.ts`
definiert und von beiden Apps importiert:

```ts
// packages/shared/src/index.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string; // ISO-8601
}

/** Payload for sending a chat message. */
export interface CreateChatMessage {
  content: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: { message: string };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

/** Type guard: narrows ApiResult<T> to ApiError. */
export function isApiError<T>(result: ApiResult<T>): result is ApiError;
/** Type guard: narrows ApiResult<T> to ApiResponse<T>. */
export function isApiSuccess<T>(result: ApiResult<T>): result is ApiResponse<T>;
```

### Import-Beispiele

```ts
// apps/api/src/services/chatService.ts
import type { ChatMessage } from 'shared';

// apps/web/src/components/Chat.tsx
import type { ApiResponse, ChatMessage } from 'shared';
```

> **Regel:** Keine lokalen Typ-Duplikate. Neue Typen/DTOs immer in `packages/shared`.

## API-Antwortformat

Jede API-Antwort folgt strikt diesem Schema:

```json
{ "data": ... }
```

oder bei Fehlern:

```json
{ "error": { "message": "..." } }
```

Die Typen `ApiResponse<T>` und `ApiError` aus `packages/shared` modellieren
dieses Format und werden in der Web-App zur Typisierung der Fetch-Antworten verwendet.

## apps/api – Struktur

| Verzeichnis               | Zweck                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `src/routes/`             | HTTP-Endpunkte: Routing, Request/Response, Validierung       |
| `src/services/`           | Business-Logik: rein, ohne HTTP-Abhängigkeiten               |
| `src/services/providers/` | Chat-Provider-Implementierungen (`mock`, `openai`)           |
| `src/config/`             | JSON-Konfiguration laden & validieren (`chatbot.rules.json`) |
| `src/app.ts`              | Express-App-Instanz (export für Tests)                       |
| `src/index.ts`            | Server-Start (`app.listen`)                                  |
| `src/__tests__/`          | Integrationstests (Vitest + Supertest)                       |

## apps/web – Struktur

| Verzeichnis/Datei      | Zweck                                              |
| ---------------------- | -------------------------------------------------- |
| `src/components/`      | React-Komponenten                                  |
| `src/__tests__/`       | Komponenten-Tests (Vitest + React Testing Library) |
| `src/test/setup.ts`    | Test-Setup (`@testing-library/jest-dom`)           |
| `src/main.tsx`         | React Entry Point                                  |
| `src/index.css`        | Material Design 3 CSS (Bootstrap + MD3-Tokens)     |
| `e2e/`                 | Playwright-E2E-Tests (headless Chromium)           |
| `playwright.config.ts` | E2E-Konfiguration (webServer startet API + Web)    |
| `vite.config.ts`       | Vite-Plugin, Dev-Proxy, Vitest-Config              |
| `index.html`           | Vite HTML-Entry                                    |

### Dev-Proxy

In der Entwicklung proxys Vite `/api/*` auf `http://localhost:3001`,
somit ist `VITE_API_URL` in dev nicht erforderlich.
In Produktion wird `VITE_API_URL` aus der Environment gesetzt.

### CORS & Prod-Deployment

In der Entwicklung proxys Vite `/api/*` auf `http://localhost:3001` (same-origin),
somit ist CORS in dev nicht relevant. In Produktion hängen Web und API typischerweise
an **unterschiedlichen Origins** – hier braucht der Browser CORS-Header oder einen
same-origin-Aufbau. Zwei Wege:

**Option A – CORS-Middleware (separate Origins):**
Die API liefert `Access-Control-Allow-Origin` für erlaubte Origins. Die erlaubten
Origins werden über `CORS_ORIGIN` (kommagetrennt) konfiguriert. Leer = alle Origins
erlauben (**nur für dev**!).

```env
CORS_ORIGIN=https://app.example.com
```

**Option B (empfohlen) – same-origin via Reverse Proxy:**
Web-Static und API werden hinter derselben Domain ausgeliefert (z. B. nginx).
CORS fällt dann komplett weg:

```nginx
server {
  listen 80;
  server_name app.example.com;

  # Web-Static (Build-Output von apps/web)
  location / {
    root /var/www/chat/web/dist;
    try_files $uri /index.html;
  }

  # API-Proxy
  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

> Empfehlung: **B** als Standard (keine Cross-Origin-Requests), **A** als
> Sicherheitsnetz, falls Web und API tatsächlich an separaten Origins laufen.

## Regeln

1. **Gemeinsame Typen** leben ausschließlich in `packages/shared`.
   Duplizierung von Typen/DTOs ist verboten.

2. **API-Antwortformat** ist strikt:

   ```json
   { "data": ... }
   { "error": { "message": "..." } }
   ```

3. **apps/api**
   - `src/routes/` – HTTP-Endpunkte (Routen-Definition, Validierung)
   - `src/services/` – Business-Logik (keine HTTP-Kenntnisse)

4. **apps/web**
   - Holt Daten über `fetch` von der API (URL: `VITE_API_URL` oder Proxy)
   - Keine direkten Datenbankzugriffe

5. **Konfiguration**
   - Secrets/Config ausschließlich aus `.env`
   - Vorlage: `.env.example`

## Monorepo-Konventionen

- npm Workspaces (keine Yarn/pnpm)
- TypeScript strict + `noUncheckedIndexedAccess`
- Gemeinsamer `tsconfig.base.json`
- ESLint flat config (root) + typescript-eslint
- Prettier für Formatting (Konflikte via `eslint-config-prettier` eliminiert)
- `shared` wird als `"shared": "*"` in die Dependencies der Apps referenziert

## Voice-Pipeline (TTS + STT)

### Überblick

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web (React 19 + Vite)                                      │
│  – useVoice.ts: TTS-Playback, STT-Aufnahme, Hands-free-Modus     │
│  – Chat.tsx: Transkript → LLM, Acknowledgment-Phrasen            │
│  – data/acknowledgments.json: Sprach-Phrasen (de, en, es)        │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTP / REST (via Vite-Proxy)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  apps/api (Express)                                              │
│  – routes/voice.ts: GET /capabilities, POST /tts, POST /stt     │
│  – services/voiceClient.ts: HTTP-Client zum voz-Sidecar          │
│    (Timeout-Handling, Capability-Cache, TTS-Retry bei 403/500)   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTP (VOICE_SERVICE_URL, Default 127.0.0.1:8765)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  apps/voz (Python, FastAPI) – optionaler Sidecar                 │
│  – TTS: edge-tts (Microsoft, Online, keine API-Key)              │
│  – STT: Whisper (OpenAI, lokal/offline)                          │
│  – GET /health, POST /tts, POST /stt                             │
└──────────────────────────────────────────────────────────────────┘
```

> **Optional:** Ohne laufenden voz-Sidecar meldet die API `tts: false, stt: false`
> über `/api/voice/capabilities`. Die Web-UI blendet die Voice-Buttons aus.
> Kein Sidecar = kein Voice, aber der Chat funktioniert normal weiter.

### Gemeinsame Typen (`packages/shared`)

```ts
export interface Voice {
  id: string;
  name: string;
  gender: 'f' | 'm';
  language: string; // "de", "en", "es"
}
export interface VoiceCapabilities {
  tts: boolean;
  stt: boolean;
  voices: Voice[];
  languages: string[];
  defaultVoiceByLanguage: Record<string, string>;
}
export interface TtsRequest {
  text: string;
  voice?: string;
}
export interface SttRequest {
  audio: string;
  language: string;
}
export interface SttResult {
  text: string;
}
```

### Hands-free-Modus (Web)

Der `useVoice`-Hook implementiert einen automatisierten Voice-Loop:

| Zustand      | Bedeutung                                        |
| ------------ | ------------------------------------------------ |
| `off`        | Hands-free deaktiviert                           |
| `listening`  | RMS-Kalibrierung + Speech-Detection (10-ms-Loop) |
| `recording`  | MediaRecorder läuft, Silence-Detection aktiv     |
| `processing` | STT läuft, UI zeigt „Verarbeite …"               |
| `paused`     | TTS-Playback aktiv, Loop blockiert               |

Übergänge: `off → listening → recording → processing → paused → listening`

#### Anti-Self-Hearing-Guards

Das System verhindert, dass die eigene TTS-Ausgabe vom Mikrofon mitgefangen
wird und als neue Sprach-Eingabe interpretiert wird („Echo-Loop"):

| Guard                           | Wo                              | Wirkung                       |
| ------------------------------- | ------------------------------- | ----------------------------- |
| `isSpeakingRef.current = true`  | `speak()` – **vor** TTS-Fetch   | Loop blockiert während TTS    |
| `isSpeakingRef.current = false` | `onended` / `onerror` / `catch` | Loop erst nach TTS-Ende       |
| `ttsEndAtRef` (500 ms)          | `onended`-Handler               | Speaker-Buffer-Flush          |
| `cooldownUntil` (500 ms)        | `handleSilence()`               | Kein Re-Trigger nach STT      |
| `SPEECH_DEBOUNCE_FRAMES` (10)   | `handleSpeechDetection()`       | 100 ms kontinuierliche Speech |
| `MIN_SPEECH_DURATION_MS` (300)  | `beginRecording()`              | Zu kurze Aufnahmen verworfen  |
| `MAX_RECORDING_MS` (15000)      | Loop                            | Hard-Cap: STT lehnt >30 s ab  |
| `processedTranscriptRef`        | `Chat.tsx` useEffect            | StrictMode-Double-Effect      |
| `transcript.length < 3`         | `Chat.tsx` useEffect            | Noise-Transkripte verworfen   |

#### RMS-Kalibrierung

- **500 ms Initial-Noise-Floor:** 50 × 10 ms-Frame gemittelt.
- **Schwellwert:** `max(noiseFloor × 3, 0.01)` – 3× über Noise-Floor.
- **Laufende Anpassung:** `noiseFloor = noiseFloor × 0.95 + rms × 0.05`
  (EMA, gleitet langsam mit, reagiert nicht auf Sprung-Artefakte).

#### Acknowledgment-Phrasen

Statt einer festen deutschen Phrase wird bei jeder TTS-Antwort eine
**zufällige, sprachabhängige** Acknowledgment-Phrase gewählt:

- **Quelle:** `apps/web/src/data/acknowledgments.json`
- **Sprachen:** `de` (10 Phrasen), `en` (10), `es` (10)
- **Fallback:** `de` → `„Einen Moment…"`
- **Auswahl:** `Math.floor(Math.random() * phrases.length)`
- **Aufruf:** `pickAcknowledgment(voice.currentLanguage)` in `Chat.tsx`

### voz-Sidecar (apps/voz)

Standalone Python-Sidecar (FastAPI), **keine** TypeScript-Dependency:

| Feature | Engine                 | Offline?    |
| ------- | ---------------------- | ----------- |
| TTS     | `edge-tts` (Microsoft) | ❌ (Online) |
| STT     | `whisper` (OpenAI)     | ✅ (lokal)  |

- **Health-Cache:** `voiceClient.ts` cached Capabilities für 5 s
  (`CACHE_TTL_MS = 5000`), um den Sidecar nicht bei jedem Request zu ping-ten.
- **TTS-Retry:** Bei HTTP 403/500 wird einmalig mit 500 ms Delay retryt
  (Edge-TTS-Token-Ablauf).
- **Timeouts:** Health 2 s, TTS 30 s, STT 30 s.
- **Docker:** `docker build -t base-chat-voz .` in `apps/voz/`.

### Voice-Konfiguration

| Env-Variable        | Workspace  | Default                                   | Zweck          |
| ------------------- | ---------- | ----------------------------------------- | -------------- |
| `VOICE_SERVICE_URL` | `apps/api` | `http://127.0.0.1:8765`                   | Sidecar-URL    |
| `VOICE_PORT`        | `apps/voz` | `8765`                                    | Sidecar-Port   |
| `WHISPER_MODEL`     | `apps/voz` | auto (`large-v3-turbo` GPU / `small` CPU) | Whisper-Modell |
