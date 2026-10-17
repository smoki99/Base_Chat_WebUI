# API – Referenz

> **Basis-URL (dev):** `http://localhost:4001`
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

| Status | Bedeutung                                             |
| ------ | ----------------------------------------------------- |
| `400`  | Ungültige Anfrage (Body, Parameter)                   |
| `403`  | CORS: Origin nicht erlaubt · Admin-Token fehlt/falsch |
| `404`  | Ressource oder Route nicht gefunden                   |
| `500`  | Interner Serverfehler                                 |

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

## Admin (Datenbank)

> **Authentifizierung:** Jeder Admin-Request braucht
> `Authorization: Bearer <ADMIN_TOKEN>`.
> Ist `ADMIN_TOKEN` leer/ungesetzt, sind **alle** Admin-Routen deaktiviert
> (`403` mit „Admin access is not configured …").

### Endpunkte im Überblick

| Method   | Pfad                               | Zweck                                  |
| -------- | ---------------------------------- | -------------------------------------- |
| `GET`    | `/api/admin/tables`                | Tabellen & Views auflisten             |
| `GET`    | `/api/admin/tables/:name/preview`  | Spalten + Zeilen-Vorschau (read-only)  |
| `GET`    | `/api/admin/tables/:name/export`   | Tabelle als CSV/XLSX herunterladen     |
| `POST`   | `/api/admin/tables/import`         | Excel/CSV als neue Tabelle importieren |
| `DELETE` | `/api/admin/tables/:name`          | Tabelle löschen (`DROP`)               |
| `GET`    | `/api/admin/relations`             | Fremdschlüssel-Beziehungen auflisten   |
| `POST`   | `/api/admin/relations`             | Fremdschlüssel anlegen                 |
| `DELETE` | `/api/admin/relations/:constraint` | Fremdschlüssel löschen                 |

`<name>` = `<schema>.<tabelle>` (z. B. `public.produtos`); `<constraint>` =
Postgres-Constraint-Name.

---

### GET /api/admin/tables

Listet alle Tabellen und Views (ohne System-Schemata).

**Response `200`**

```json
{
  "data": [
    { "schema": "public", "table": "Firmen", "kind": "table" },
    { "schema": "public", "table": "groesse", "kind": "view" }
  ]
}
```

**Fehler**

| Status | Bedingung                                  |
| ------ | ------------------------------------------ |
| `403`  | Token fehlt, falsch oder Admin deaktiviert |
| `500`  | Datenbankfehler (z. B. keine Verbindung)   |

---

### GET /api/admin/tables/:name/preview

Spalten-Metadaten + erste Zeilen (Default 20, `?limit=` 1–1000). Read-only.

**Response `200`**

```json
{
  "data": {
    "schema": "public",
    "table": "Firmen",
    "columns": [
      { "name": "Index", "dataType": "integer", "nullable": false },
      { "name": "Name", "dataType": "text", "nullable": true }
    ],
    "rows": [{ "Index": 1, "Name": "Ferrell LLC" }],
    "hasMore": true,
    "limit": 20
  }
}
```

**Fehler**

| Status | Bedingung                    |
| ------ | ---------------------------- |
| `400`  | `limit` nicht ganzzahlig > 0 |
| `404`  | Tabelle/View nicht gefunden  |

---

### GET /api/admin/tables/:name/export

Lädt die Tabelle als **Datei-Download** (kein JSON-Envelope).

| Query-Parameter | Default | Beschreibung                                                 |
| --------------- | ------- | ------------------------------------------------------------ |
| `format`        | `csv`   | `csv` oder `xlsx`                                            |
| `limit`         | –       | max. Zeilen (nur ≤ `ADMIN_EXPORT_MAX_ROWS`, Default `10000`) |

**Response `200`**

| `format` | `Content-Type`                                                      | `Content-Disposition`                   |
| -------- | ------------------------------------------------------------------- | --------------------------------------- |
| `csv`    | `text/csv; charset=utf-8` (UTF-8-BOM, CRLF, RFC-4180-Escapes)       | `attachment; filename="<Tabelle>.csv"`  |
| `xlsx`   | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `attachment; filename="<Tabelle>.xlsx"` |

> **Trunkation:** Wird das Zeilen-Cap erreicht, enthält die Datei nur die
> ersten N Zeilen. Die Web-UI zeigt die Meldung; bei `curl` ist die
> tatsächliche Zeilenanzahl der Datei der Indikator.

**Fehler**

| Status | Bedingung                                             |
| ------ | ----------------------------------------------------- |
| `400`  | `format` ≠ `csv`/`xlsx` · `limit` ungültig oder > Cap |
| `404`  | Tabelle/View nicht gefunden                           |

---

### POST /api/admin/tables/import

Importiert eine Excel/CSV-Datei (multipart/form-data, max. 25 MB) als neue
Tabelle. Typableitung pro Spalte (integer, numeric, boolean, timestamp, text).

**Request** – `multipart/form-data` mit dem Feld `file`

**Response `201`**

```json
{
  "data": {
    "schema": "public",
    "table": "firmen",
    "columns": [{ "name": "name", "dataType": "text", "nullable": true }],
    "rowsImported": 42
  }
}
```

**Fehler**

| Status | Bedingung                         |
| ------ | --------------------------------- |
| `400`  | Datei fehlt / kein Excel oder CSV |
| `413`  | Datei > 25 MB                     |
| `500`  | Datenbankfehler                   |

---

### DELETE /api/admin/tables/:name

Löscht die Tabelle (`DROP TABLE`). Views: `DROP VIEW`.

**Response `200`**

```json
{ "data": { "schema": "public", "table": "firmen" } }
```

---

### GET /api/admin/relations

Listet alle Fremdschlüssel-Beziehungen (ohne System-Schemata).

**Response `200`**

```json
{
  "data": [
    {
      "constraint": "orders_customer_fkey",
      "sourceSchema": "public",
      "sourceTable": "orders",
      "sourceColumn": "customerId",
      "targetSchema": "public",
      "targetTable": "customers",
      "targetColumn": "id"
    }
  ]
}
```

---

### POST /api/admin/relations

Legt einen Fremdschlüssel an. Schemas Default: `public`.

**Request-Body**

```json
{
  "sourceTable": "orders",
  "sourceColumn": "customerId",
  "targetTable": "customers",
  "targetColumn": "id"
}
```

**Response `201`** – wie `GET /api/admin/relations` (ein Element in `data`)

**Fehler**

| Status | Bedingung                                |
| ------ | ---------------------------------------- |
| `400`  | Fehlende Felder · Spalte existiert nicht |

---

### DELETE /api/admin/relations/:constraint

Entfernt den Fremdschlüssel `<constraint>` (`ALTER TABLE … DROP CONSTRAINT`).

**Response `200`**

```json
{ "data": { "constraint": "orders_customer_fkey" } }
```

**Fehler**

| Status | Bedingung                 |
| ------ | ------------------------- |
| `404`  | Constraint nicht gefunden |

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
