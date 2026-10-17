# base-chat-webui

Eine schlanke, lokale Chat-App: **Vite + React 19 + TypeScript** im Frontend, **Express + TypeScript (tsx)** im Backend.
Chat-Verhalten über JSON-Regeln steuerbar, Provider-agnostisch (Mock, OpenAI-kompatible Endpunkte wie LM Studio / Ollama), Voice über einen separaten Python-Sidecar.

## Features

- 💬 Chat-UI mit Markdown, Code-Blöcken, Copy-Buttons und Konversations-Verlauf
  (letzte 20 Nachrichten, konfigurierbar via `VITE_CONTEXT_MESSAGES`)
- 🧠 Chatbot-Regeln (JSON) werden serverseitig als System-Prompt injiziert
- ✍️ Eigener Chatbot-Prompt: nutzerdefinierte Prompt-Erweiterung (z. B. Glossar
  für importierte Tabellen) in den Einstellungen – serverseitig gespeichert,
  für alle Nutzer der Instanz (Story-0036)
- 🔌 Provider-agnostisch: `mock`, `openai` (OpenAI-kompatibel: LM Studio, Ollama, …)
- 🛡️ Sicherheit: `helmet`, CORS-Whitelist, Rate-Limit, Input-Sanitizing, JSON-Size-Limit
- 🔊 Voice: TTS (edge-tts) + STT (Whisper) über den `voz`-Sidecar
- 🗄️ Admin-Panel: Excel/CSV-Import nach PostgreSQL, Schema-Vorschau, **CSV/XLSX-Export**
- 🧩 MCP-Tools für den Chat: `qmd`, `sql`, `admin-db` (read-only SQL auf importierte Tabellen) + `export_table` (einmalige Download-Links für Tabellen, direkt im Chat teilbar)
- 🎨 UI-Customization: Themes, Logo & Banner (client-seitig, `localStorage`)
- 📦 Monorepo mit npm Workspaces, zentraler Prettier/ESLint-Konfiguration
- 🧪 Tests: Vitest (API + Web) + Playwright-E2E, `dependency-cruiser` gegen Zyklen

## Architektur

```
┌────────────┐   HTTP   ┌────────────────┐  stdio   ┌─────────────────────┐
│  React UI  │ ──────►  │  Express API   │ ──────►  │      MCP-Server     │ (optional)
│   :5173    │          │  :4001 (tsx)   │          │ qmd, sql, admin-db  │
└────────────┘          └───────┬────────┘          └─────────────────────┘
                                │ HTTP
                         ┌──────▼────────┐
                         │ voz (Python)  │  TTS (edge-tts) + STT (Whisper)
                         │ :8765         │
                         └───────────────┘
```

**Pakete**

| Pfad               | Zweck                                          |
| ------------------ | ---------------------------------------------- |
| `apps/web`         | React-UI (Vite, Bootstrap, react-markdown)     |
| `apps/api`         | Express-API, Provider-Logik, MCP-Client        |
| `apps/voz`         | Voice-Sidecar (FastAPI, TTS/STT)               |
| `markdown-knowhow` | Wissensbasis (Markdown), von MCP/`qmd` genutzt |

## Voraussetzungen

- **Node.js ≥ 24** (siehe `.nvmrc`)
- Optional: **Python ≥ 3.11** für den Voice-Sidecar
- Optional: **PostgreSQL** für das SQL-Tool (MCP)

## Quick start

```bash
npm install
cp .env.example .env          # Werte ggf. anpassen
npm run dev                   # startet API (4001) + Web (5173) parallel
```

- Web: http://localhost:5173
- API: http://localhost:4001/health
- API-Docs: http://localhost:4001/docs

> `npm run dev` startet `concurrently` über `tsx watch` (API) und `vite` (Web).
> Beenden mit `Ctrl+C` (dev:clean toetet zusätzlich verwaiste Prozesse: `npm run dev:clean`).

## Chat-Provider konfigurieren

| Variable                     | Beschreibung                                                                                                                                           | Default                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `PORT`                       | API-Port                                                                                                                                               | `4001`                  |
| `CORS_ORIGIN`                | Erlaubte CORS-Origin(s), kommagetrennt. **Fail-closed:** in Produktion (`NODE_ENV=production`) werden Cross-Origin-Requests bei leerer Liste abgelehnt | leer (dev: alle)        |
| `RATE_LIMIT_GENERAL`         | Rate-Limit (Requests/Fenster) für API-Routen (außer `/api/voice/*`)                                                                                    | `100` (60 s)            |
| `RATE_LIMIT_VOICE`           | Rate-Limit (Requests/Fenster) für `/api/voice/*`                                                                                                       | `20` (60 s)             |
| `CHAT_PROVIDER`              | Aktiver Chat-Provider: `mock` oder `openai`                                                                                                            | `mock`                  |
| `OPENAI_BASE_URL`            | Basis-URL für OpenAI-kompatible Endpunkte (z. B. `http://localhost:1234/v1`)                                                                           | leer                    |
| `OPENAI_API_KEY`             | API-Key (leer = kein Header, z. B. für lokale Modelle)                                                                                                 | leer                    |
| `OPENAI_MODEL`               | Modellname (z. B. `gpt-4o`, `llama3.1-8b`)                                                                                                             | leer                    |
| `CHATBOT_RULES_FILE`         | Pfad zur `chatbot.rules.json` (leer = eingebauter Default)                                                                                             | leer                    |
| `CHATBOT_CUSTOM_PROMPT_FILE` | Pfad zur Custom-Prompt-Datei (Story-0036; leer = `apps/api/data/chatbot-custom-prompt.md`, gitignored)                                                 | leer                    |
| `VOICE_SERVICE_URL`          | Base-URL des Voice-Sidecars (`apps/voz`), leer = Voice deaktiviert                                                                                     | `http://127.0.0.1:8765` |
| `ADMIN_TOKEN`                | Token für das Admin-Panel (`Authorization: Bearer <Token>`); leer = Admin-Routen deaktiviert                                                           | `change-me`             |
| `ADMIN_EXPORT_MAX_ROWS`      | Zeilen-Cap für den CSV/XLSX-Tabelle-Export (Per-Request-`limit` darf nur darunter)                                                                     | `10000`                 |

```env
CHAT_PROVIDER=mock            # oder: openai
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio
OPENAI_MODEL=local-model
```

- `mock` – liefert deterministische Antworten, ideal für UI-Tests ohne Backend.
- `openai` – jeder OpenAI-kompatible Endpunkt (LM Studio auf `:1234`, Ollama mit OpenAI-Plugin, …).

## Chatbot-Regeln

`apps/api/chatbot.rules.json` wird serverseitig geladen und als System-Prompt vorangestellt:

```json
{
  "systemPrompt": "Du bist ein freundlicher Assistent für lokale Produkt-Fragen.",
  "rules": ["Antworte auf Deutsch.", "Zitiere Quellen aus der Wissensbasis."],
  "disabled": []
}
```

Pfad über `CHATBOT_RULES_FILE` überschreibbar (Default: `apps/api/chatbot.rules.json`).

> **Rate-Limiting:** Die API begrenzt Anfragen (in-memory, pro Prozess) –
> Standard ≤ 100 Requests/60 s, `/api/voice/*` ≤ 20 Requests/60 s, `/health` unbegrenzt.
> Bei Überschreitung: `429 { "error": { "message": "Rate limit exceeded, please slow down" } }`.
> Grenzwerte via `RATE_LIMIT_GENERAL` / `RATE_LIMIT_VOICE` (Default-Werte s. Tabelle oben).

## Voice (TTS + STT)

Der Voice-Sidecar (`apps/voz`, FastAPI) läuft separat auf Port `8765`:

```bash
cd apps/voz
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python voz.py
```

`.env`:

```env
VOICE_SERVICE_URL=http://127.0.0.1:8765
```

Die UI nutzt `POST /api/voice/tts` (MP3-Stream) und `POST /api/voice/stt` (Audio-Upload → Transkript).
Details: [`apps/voz/README.md`](apps/voz/README.md).

## MCP (Model Context Protocol)

Die API kann optional MCP-Server als Chat-Tools anbinden (z. B. `sql`, `qmd`, `admin-db`).
MCP-Server laufen als **Subprozesse** der API – daher die Sicherheitseinstellungen:

| Variable                 | Default | Beschreibung                                                                                                            |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `MCP_CONFIG_FILE`        | –       | Pfad zur MCP-Server-Konfiguration (Default: `apps/api/mcp-config.json`, falls vorhanden)                                |
| `MCP_ENABLED_SERVERS`    | leer    | **Whitelist** – nur aufgeführte Server-Namen werden gestartet (z. B. `sql`). Leer = alle konfigurierten Server (Legacy) |
| `MCP_REQUEST_TIMEOUT_MS` | `30000` | Timeout pro MCP-JSON-RPC-Request                                                                                        |

```bash
# Beispiel: nur den SQL-Server aktivieren
MCP_CONFIG_FILE=./apps/api/mcp-config.json MCP_ENABLED_SERVERS=sql npm run dev -w apps/api
```

> **Sicherheit:** Einträge in `mcp-config.json` starten beliebige Befehle –
> behandeln Sie die Datei wie Code. Secrets (z. B. `DATABASE_URL`) gehören in
> die Umgebung, nicht in die Konfigurationsdatei. Nur geprüfte MCP-Server aktivieren.

## Admin-Panel (Datenbank)

Das Admin-Panel (Dialog im Web) verwaltet eine lokale PostgreSQL-Datenbank:

| Feature         | Beschreibung                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Import**      | Excel/CSV-Datei (max. 25 MB) → neue Tabelle inkl. automatischer Typableitung                                                                           |
| **Vorschau**    | Spalten + erste 20 Zeilen einer Tabelle (read-only)                                                                                                    |
| **Export**      | `CSV` (BOM + RFC-4180, Excel-kompatibel) oder `XLSX` – serverseitig generiert                                                                          |
| **Chat-Export** | LLM erzeugt über das MCP-Tool `export_table` einen **einmaligen Download-Link** (CSV/XLSX) und teilt ihn im Chat – gültig 15 Min., on-demand generiert |
| **Relationen**  | Fremdschlüssel-Beziehungen anlegen/listen/löschen                                                                                                      |
| **Löschen**     | Tabelle per `DROP` entfernen                                                                                                                           |

- Auth: `ADMIN_TOKEN` als `Authorization: Bearer <Token>`; ohne Token sind alle
  Admin-Routen deaktiviert (403).
- Der Settings-Tab „Chatbot-Prompt“ (eigene Prompt-Erweiterung für den
  Chatbot, Story-0036) nutzt denselben `ADMIN_TOKEN`; die gespeicherte Datei
  liegt unter `apps/api/data/` (gitignored) – nie im Repository.
- Export-Cap: `ADMIN_EXPORT_MAX_ROWS` (Default `10000`); größere Exporte werden
  auf die ersten N Zeilen gekürzt und die UI meldet die Trunkation.
- API-Referenz aller Endpunkte: [`docs/API.md`](docs/API.md#admin-datenbank)
- Optional: Chat-Zugriff auf die Tabellen über den MCP-Server `admin-db`
  (read-only, s. Abschnitt [MCP](#mcp-model-context-protocol)).

## Testen

```bash
npm test                      # alle Pakete (API + Web)
npm test -w apps/api          # nur API
npm test -w apps/web          # nur Web
```

## Produktion

```bash
npm run build                 # baut alle Pakete
npm start -w apps/api         # API (tsx src/index.ts)
# Web: `npm run build -w apps/web` → apps/web/dist (statisch hosten)
```

## Umgebungsvariablen (Auszug)

| Variable            | Default                    | Beschreibung                     |
| ------------------- | -------------------------- | -------------------------------- |
| `PORT`              | `4001`                     | API-Port                         |
| `HOST`              | `127.0.0.1`                | Bind-Adresse (Default: Loopback) |
| `CHAT_PROVIDER`     | `mock`                     | `mock` \| `openai`               |
| `OPENAI_BASE_URL`   | `http://localhost:1234/v1` | OpenAI-kompatibler Endpunkt      |
| `VOICE_SERVICE_URL` | `http://127.0.0.1:8765`    | voz-Sidecar-URL                  |

Vollständige Liste: [`.env.example`](.env.example).

## Lizenz

MIT – siehe [LICENSE](LICENSE).
