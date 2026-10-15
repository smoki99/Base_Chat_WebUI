# base-chat-webui

Eine schlanke, lokale Chat-App: **Vite + React 19 + TypeScript** im Frontend, **Express + TypeScript (tsx)** im Backend.
Chat-Verhalten über JSON-Regeln steuerbar, Provider-agnostisch (Mock, OpenAI-kompatible Endpunkte wie LM Studio / Ollama), Voice über einen separaten Python-Sidecar.

## Features

- 💬 Chat-UI mit Markdown, Code-Blöcken, Copy-Buttons und „Letzte 5" Verlauf
- 🧠 Chatbot-Regeln (JSON) werden serverseitig als System-Prompt injiziert
- 🔌 Provider-agnostisch: `mock`, `openai` (OpenAI-kompatibel: LM Studio, Ollama, …)
- 🛡️ Sicherheit: `helmet`, CORS-Whitelist, Rate-Limit, Input-Sanitizing, JSON-Size-Limit
- 🔊 Voice: TTS (edge-tts) + STT (Whisper) über den `voz`-Sidecar
- 📦 Monorepo mit npm Workspaces, zentraler Prettier/ESLint-Konfiguration
- 🧪 Tests mit Vitest (API + Web), `dependency-cruiser` gegen Zyklen

## Architektur

```
┌────────────┐   HTTP    ┌────────────────┐   stdio   ┌──────────────┐
│  React UI  │ ────────► │  Express API   │ ─────────► │  MCP-Server  │ (optional)
│ :3000/5173 │           │  :3001 (tsx)   │            │  (qmd, sql)  │
└────────────┘           └───────┬────────┘            └──────────────┘
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
| `packages/config`  | Geteilte Prettier-/ESLint-Konfiguration        |
| `markdown-knowhow` | Wissensbasis (Markdown), von MCP/`qmd` genutzt |

## Voraussetzungen

- **Node.js ≥ 22** (siehe `.nvmrc`)
- Optional: **Python ≥ 3.11** für den Voice-Sidecar
- Optional: **PostgreSQL** für das SQL-Tool (MCP)

## Quick start

```bash
npm install
cp .env.example .env          # Werte ggf. anpassen
npm run dev                   # startet API (3001) + Web (5173) parallel
```

- Web: http://localhost:5173
- API: http://localhost:3001/health
- API-Docs: http://localhost:3001/docs

> `npm run dev` startet `concurrently` über `tsx watch` (API) und `vite` (Web).
> Beenden mit `Ctrl+C` (dev:clean toetet zusätzlich verwaiste Prozesse: `npm run dev:clean`).

## Chat-Provider konfigurieren

`.env`:

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

Die API kann optional MCP-Server als Chat-Tools anbinden (z. B. `sql`, `qmd`).
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
| `PORT`              | `3001`                     | API-Port                         |
| `HOST`              | `127.0.0.1`                | Bind-Adresse (Default: Loopback) |
| `CHAT_PROVIDER`     | `mock`                     | `mock` \| `openai`               |
| `OPENAI_BASE_URL`   | `http://localhost:1234/v1` | OpenAI-kompatibler Endpunkt      |
| `VOICE_SERVICE_URL` | `http://127.0.0.1:8765`    | voz-Sidecar-URL                  |

Vollständige Liste: [`.env.example`](.env.example).

## Lizenz

MIT – siehe [LICENSE](LICENSE).
