# API – Referenz

> **Basis-URL (dev):** `http://localhost:3001`
> **Content-Type:** `application/json`
> **Antwort-Envelope:** `{ "data": ... }` bei Erfolg · `{ "error": { "message": "..." } }` bei Fehlern

---

## Endpunkte

### GET /health

Liveness-Probe – prüft, ob die API erreichbar ist.

**Response `200`**

```json
{ "data": { "status": "ok", "uptime": 42.13 } }
```

---

### POST /api/chat

Sendet eine Chat-Nachricht an den aktiven Provider.

**Request-Body**

| Feld      | Typ    | Pflicht | Beschreibung                              |
| --------- | ------ | ------- | ----------------------------------------- |
| `message` | string | ✅      | Nachricht (nicht leer, max. 2000 Zeichen) |

```json
{ "message": "Hallo!" }
```

**Response `201`**

```json
{
  "data": {
    "id": "mock-1735689600000-123456",
    "content": "Hallo! Wie kann ich helfen?"
  }
}
```

**Fehler**

| Status | Körper                                                                  | Bedingung                              |
| ------ | ----------------------------------------------------------------------- | -------------------------------------- |
| `400`  | `{ "error": { "message": "message is required" } }`                     | `message` fehlt, leer oder kein String |
| `400`  | `{ "error": { "message": "message must be at most 2000 characters" } }` | `message` länger als 2000 Zeichen      |
| `500`  | `{ "error": { "message": "Internal server error" } }`                   | Provider-Fehler (Timeout, API-Fehler)  |

---

### GET /api/chat/health

Liefert den Status des aktiven Chat-Providers.

**Response `200`**

```json
{
  "data": {
    "status": "healthy",
    "provider": "mock",
    "detail": "Mock provider is always available."
  }
}
```

**Response `503`** (Provider nicht erreichbar)

```json
{
  "data": {
    "status": "unhealthy",
    "provider": "openai",
    "detail": "Connection failed"
  }
}
```

---

## Fehler-Format (gemeinsam)

Alle Fehlerantworten folgen demselben Schema:

```json
{ "error": { "message": "<menschleserbare Beschreibung>" } }
```

| Status | Bedeutung                           |
| ------ | ----------------------------------- |
| `400`  | Ungültige Anfrage (Body, Parameter) |
| `403`  | CORS: Origin nicht erlaubt          |
| `404`  | Ressource oder Route nicht gefunden |
| `500`  | Interner Serverfehler               |

---

## Typ-Referenz (packages/shared)

| Typ              | Definition                       |
| ---------------- | -------------------------------- |
| `ApiResponse<T>` | `{ data: T }`                    |
| `ApiError`       | `{ error: { message: string } }` |
| `ApiResult<T>`   | `ApiResponse<T> \| ApiError`     |

> Quelle: `packages/shared/src/index.ts`

---

## Typ-Referenz (API-intern)

| Typ            | Definition                                              |
| -------------- | ------------------------------------------------------- |
| `ChatMessage`  | `{ id: string; content: string }`                       |
| `HealthStatus` | `{ status: "healthy" \| "unhealthy"; detail?: string }` |

> Quelle: `apps/api/src/types/chat.ts`

---

## Voice (TTS + STT)

> **Voraussetzung:** Laufender voz-Sidecar (`apps/voz`) auf `VOICE_SERVICE_URL`
> (Default `http://127.0.0.1:8765`). Ohne Sidecar: `tts: false, stt: false`.

### GET /api/voice/capabilities

Liefert die aktuelle Voice-Verfügbarkeit, verfügbare Stimmen und Sprachen.

**Response `200`**

```json
{
  "data": {
    "tts": true,
    "stt": true,
    "voices": [
      { "id": "de-DE-Webm-1", "name": "Webm (German, Female)", "gender": "f", "language": "de" },
      { "id": "en-US-Webm-1", "name": "Webm (English, Female)", "gender": "f", "language": "en" }
    ],
    "languages": ["de", "en", "es"],
    "defaultVoiceByLanguage": { "de": "de-DE-Webm-1", "en": "en-US-Webm-1", "es": "es-ES-Webm-1" }
  }
}
```

**Response `200`** (Sidecar nicht erreichbar)

```json
{
  "data": {
    "tts": false,
    "stt": false,
    "voices": [],
    "languages": [],
    "defaultVoiceByLanguage": {}
  }
}
```

> **Cache:** Die API cached die Capabilities für 5 s (`CACHE_TTL_MS`),
> um den Sidecar nicht bei jedem Request zu belasten.

---

### POST /api/voice/tts

Synthetisiert Text zu Audio (MP3) via Edge-TTS.

**Request-Body**

| Feld    | Typ    | Pflicht | Beschreibung                         |
| ------- | ------ | ------- | ------------------------------------ |
| `text`  | string | ✅      | Text (nicht leer, max. 2000 Zeichen) |
| `voice` | string | –       | Voice-ID (Default: Sprache-Default)  |

```json
{ "text": "Hallo, wie kann ich helfen?" }
```

**Response `200`** – binärer Audio-Stream (`Content-Type: audio/mpeg`)

**Fehler**

| Status | Bedingung                                  |
| ------ | ------------------------------------------ |
| `400`  | `text` fehlt, leer oder > 2000 Zeichen     |
| `500`  | Sidecar-Fehler (Timeout, Edge-TTS-Ausfall) |

> **Retry:** Bei HTTP 403/500 wird einmalig mit 500 ms Delay retryt
> (Edge-TTS-Token-Ablauf).

---

### POST /api/voice/stt

Transkribiert Audio (Base64) zu Text via Whisper.

**Request-Body**

| Feld       | Typ    | Pflicht | Beschreibung                       |
| ---------- | ------ | ------- | ---------------------------------- |
| `audio`    | string | ✅      | Base64-kodiertes Audio (WebM/Opus) |
| `language` | string | –       | STT-Sprache (Default: `de`)        |

```json
{ "audio": "Base64...", "language": "de" }
```

**Response `200`**

```json
{ "data": { "text": "Hallo, ich brauche Hilfe mit dem Setup." } }
```

**Fehler**

| Status | Bedingung                                      |
| ------ | ---------------------------------------------- |
| `400`  | `audio` fehlt oder leer                        |
| `500`  | Sidecar-Fehler (Whisper-Timeout, Modellfehler) |

---

## Voice-Typen (packages/shared)

| Typ                 | Definition                                                |
| ------------------- | --------------------------------------------------------- |
| `Voice`             | `{ id, name, gender: "f" \| "m", language }`              |
| `VoiceCapabilities` | `{ tts, stt, voices, languages, defaultVoiceByLanguage }` |
| `TtsRequest`        | `{ text: string; voice?: string }`                        |
| `SttRequest`        | `{ audio: string; language: string }`                     |
| `SttResult`         | `{ text: string }`                                        |

> Quelle: `packages/shared/src/index.ts`
