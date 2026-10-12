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

### GET /api/todos

Listet alle Todos auf.

**Response `200`**

```json
{
  "data": [
    { "id": 1, "title": "Einkaufen", "done": false },
    { "id": 2, "title": "Code review", "done": true }
  ]
}
```

---

### POST /api/todos

Legt ein neues Todo an.

**Request-Body**

| Feld    | Typ    | Pflicht | Beschreibung       |
| ------- | ------ | ------- | ------------------ |
| `title` | string | ✅      | Titel (nicht leer) |

```json
{ "title": "Einkaufen" }
```

**Response `201`**

```json
{ "data": { "id": 3, "title": "Einkaufen", "done": false } }
```

**Fehler**

| Status | Körper                                                      | Bedingung                            |
| ------ | ----------------------------------------------------------- | ------------------------------------ |
| `400`  | `{ "error": { "message": "Title darf nicht leer sein." } }` | `title` fehlt, leer oder kein String |

---

### PATCH /api/todos/:id

Aktualisiert ein bestehendes Todo (Titel und/oder `done`-Flag).

**Path-Parameter**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | number | ID des Todos |

**Request-Body** (mindestens ein Feld)

| Feld    | Typ     | Beschreibung      |
| ------- | ------- | ----------------- |
| `title` | string  | Neuer Titel       |
| `done`  | boolean | Fertig-Markierung |

```json
{ "done": true }
```

```json
{ "title": "Umformuliert", "done": false }
```

**Response `200`**

```json
{ "data": { "id": 3, "title": "Einkaufen", "done": true } }
```

**Fehler**

| Status | Körper                                                           | Bedingung                     |
| ------ | ---------------------------------------------------------------- | ----------------------------- |
| `400`  | `{ "error": { "message": "Invalid request body" } }`             | Body leer oder ungültige ID   |
| `400`  | `{ "error": { "message": "Title darf nicht leer sein." } }`      | `title` leer oder kein String |
| `400`  | `{ "error": { "message": "Done muss ein boolean Wert sein." } }` | `done` kein Boolean           |
| `404`  | `{ "error": { "message": "Not found" } }`                        | Todo mit ID existiert nicht   |

---

### DELETE /api/todos/:id

Löscht ein Todo.

**Path-Parameter**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | number | ID des Todos |

**Response `204`** – kein Body.

**Fehler**

| Status | Körper                                    | Bedingung            |
| ------ | ----------------------------------------- | -------------------- |
| `404`  | `{ "error": { "message": "Not found" } }` | Todo existiert nicht |

---

## Chat

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

| Typ              | Definition                                     |
| ---------------- | ---------------------------------------------- |
| `Todo`           | `{ id: number; title: string; done: boolean }` |
| `CreateTodo`     | `{ title: string }`                            |
| `UpdateTodo`     | `{ title?: string; done?: boolean }`           |
| `ApiResponse<T>` | `{ data: T }`                                  |
| `ApiError`       | `{ error: { message: string } }`               |
| `ApiResult<T>`   | `ApiResponse<T> \| ApiError`                   |

> Quelle: `packages/shared/src/index.ts`

---

## Typ-Referenz (API-intern)

| Typ            | Definition                                              |
| -------------- | ------------------------------------------------------- |
| `ChatMessage`  | `{ id: string; content: string }`                       |
| `HealthStatus` | `{ status: "healthy" \| "unhealthy"; detail?: string }` |

> Quelle: `apps/api/src/types/chat.ts`
