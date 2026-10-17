# Deployment (Docker / Portainer)

> Docker-Deployment für **base-chat-webui**: App-Stack (Web + API + Postgres)
> auf dem Portainer-Host, Voice-Sidecar (voz) + LM Studio auf der lokalen
> RTX-5090-Maschine (`192.168.178.117`).
>
> **Security-Grundprinzip:** Host-exponiert ist **nur der Web-Port (5173)**.
> `api:4001` und `postgres:5432` leben im internen Compose-Netz.
> `voz:8765` und `LM-Studio:1234` sind **LAN-only, niemals Internet**
> (beide unauthentifiziert).

## Architektur

```
Browser ──► [Portainer-Host]
              web (nginx:8080, non-root) ──/api/*──► api (node:4001, intern, non-root)
                                                          ├──► LM Studio  http://192.168.178.117:1234/v1  [5090, nativ]
                                                          ├──► voz        http://192.168.178.117:8765        [5090, Docker]
                                                          └──► postgres  postgres:5432 (intern, Volume)
              voz (5090) ──► edge-tts (Internet), HF-Modell-Download (1. Start)
```

| Image                                 | Base                                            | Host      | Ports           | Notes                                                  |
| ------------------------------------- | ----------------------------------------------- | --------- | --------------- | ------------------------------------------------------ |
| `ghcr.io/smoki99/base-chat-webui-web` | `nginx:stable-alpine`                           | Portainer | `5173:8080`     | SPA + `/api/*`-Proxy, non-root                         |
| `ghcr.io/smoki99/base-chat-webui-api` | `node:24-alpine`                                | Portainer | `4001` (intern) | **tsx-Runtime**, non-root, Prompt-Vol                  |
| `postgres`                            | `postgres:16-alpine`                            | Portainer | `5432` (intern) | Init via `apps/api/db/*.sql`                           |
| `ghcr.io/smoki99/base-chat-webui-voz` | `pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime` | 5090      | `8765` (LAN)    | Whisper (GPU→`large-v3-turbo` / CPU→`small`), non-root |

## 1. 5090-Maschine (voz)

voz läuft immer im **CUDA-Image** (`pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime`).
torch erkennt das Device selbst: **GPU vorhanden →** `whisper-large-v3-turbo`,
**keine GPU →** CPU + `whisper-small`. TTS (edge-tts) ist davon unabhängig.

**CPU (ohne GPU-Toolkit – funktioniert immer):**

```bash
docker build -t ghcr.io/smoki99/base-chat-webui-voz:latest apps/voz
docker compose -f deploy/voz/docker-compose.yml up -d
```

**GPU (5090 reservieren – braucht `nvidia-container-toolkit` auf dem Host):**

```bash
docker compose -f deploy/voz/docker-compose.yml \
              -f deploy/voz/docker-compose.gpu.yml up -d
```

```bash
# Prüfung
curl -s http://192.168.178.117:8765/health | python3 -m json.tool   # tts:true, stt:true
docker logs voz-voz-1 2>&1 | tail   # "device cuda|cpu" + Whisper-Status
```

- HF-Modell-Cache liegt im Volume `voz_hf-cache` → kein Re-Download nach Neustart.
- LM-Studio lokal starten, OpenAI-Server auf `:1234` (LAN-reichbar, **nie Internet**).
- **GPU-Toolkit nachinstallieren?** `nvidia-smi` muss funktionieren, dann
  `nvidia-container-toolkit` installieren + Docker neu starten, danach mit dem
  `-f docker-compose.gpu.yml`-Flag starten (siehe `docker-compose.gpu.yml`).

## 2. Images bauen & nach GHCR pushen (auf der 5090)

```bash
# Login (Personal Access Token mit "Read and write" für Packages)
echo "$GHCR_TOKEN" | docker login ghcr.io -u smoki99 --password-stdin

# api + web bauen (Context = Repo-Root!) und pushen
docker build -f apps/api/Dockerfile -t ghcr.io/smoki99/base-chat-webui-api:latest .
docker push ghcr.io/smoki99/base-chat-webui-api:latest
docker build -f apps/web/Dockerfile -t ghcr.io/smoki99/base-chat-webui-web:latest .
docker push ghcr.io/smoki99/base-chat-webui-web:latest
```

## 3. Portainer-Host (Haupt-Stack)

1. **Env vorbereiten:** `deploy/.env.example` kopieren und anpassen
   (`POSTGRES_PASSWORD`, `ADMIN_TOKEN`, ggf. 5090-IP).
2. **Stack deployen** (Portainer UI → _Stacks_ → Repo-URL + Compose-File
   `deploy/docker-compose.yml`, oder CLI):

```bash
docker compose -f deploy/docker-compose.yml pull    # Images von GHCR
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml ps      # alle "healthy"
```

3. **Smoke-Tests:**

```bash
curl -s http://<portainer-host>:5173/                  # UI lädt
docker compose -f deploy/docker-compose.yml exec api wget -qO- http://127.0.0.1:4001/health
curl -s http://<portainer-host>:5173/api/status        # LLM/DB/voice-Probe (über nginx)
# Chat (UI oder): POST /api/chat mit {"message":"Hallo"}
# Voice (UI oder): GET /api/voice/capabilities
```

4. **Persistenz prüfen:** `docker compose -f deploy/docker-compose.yml restart`
   → `products`-Tabelle (100 Seeds) + gespeicherter Custom Prompt bleiben erhalten
   (Volumes `base-chat-webui_pgdata` / `base-chat-webui_prompt-data`).

## 4. Konfiguration (Env-Variablen)

Alle Variablen: `deploy/.env.example` (kommentiert, ohne echte Secrets).
Wichtigste:

| Variable            | Default                          | Bedeutung                                                     |
| ------------------- | -------------------------------- | ------------------------------------------------------------- |
| `WEB_PORT`          | `5173`                           | einziger Host-Port des Stacks                                 |
| `CHAT_PROVIDER`     | `openai`                         | `openai` = LM-Studio/OpenAI-kompatibel, `mock` = Offline-Demo |
| `OPENAI_BASE_URL`   | `http://192.168.178.117:1234/v1` | LM Studio auf der 5090                                        |
| `VOICE_SERVICE_URL` | `http://192.168.178.117:8765`    | voz auf der 5090                                              |
| `DATABASE_URL`      | (aus `POSTGRES_PASSWORD`)        | intern: `postgres://chatbot:…@postgres:5432/chatbot`          |
| `ADMIN_TOKEN`       | (Pflicht)                        | DB-Admin-Dialog; leer = 403 (Feature aus)                     |
| `CORS_ORIGIN`       | `http://localhost:5173`          | nur bei direktem API-Zugriff relevant                         |

**MCP ist in Prod deaktiviert** (`MCP_CONFIG_FILE=/etc/mcp-disabled.json`):
Achtung – ein _leeres_ `MCP_ENABLED_SERVERS` bedeutet "alle Server" (Legacy);
daher zeigt die Config-Datei auf einen nicht-existierenden Pfad.

**Custom Prompt:** Volume `prompt-data` auf `/app/apps/api/data`
(Standard-Pfad der API). Optional überschreibbar via `CHATBOT_CUSTOM_PROMPT_FILE`.

## 5. Betrieb & Updates

- **Update:** neue Images bauen + pushen → auf dem Portainer-Host
  `docker compose pull && docker compose up -d` (Volumes bleiben erhalten).
- **Logs:** `docker compose -f deploy/docker-compose.yml logs -f [web|api|postgres]`.
- **DB-Backup:** `docker compose … exec postgres pg_dump -U chatbot chatbot > dump.sql`.
- **Kompletter Reset:** `docker compose … down -v` (löschtdie Volumes inkl. Daten!).

## 6. Bekannte Grenzen (out of scope)

- Kein HTTPS/TLS (kann später via Traefik/Cloudflare/Portainer-Proxy).
- Keine CI-Docker-Build-Pipeline / Registry-Automation (manuell, siehe Schritt 2).
- LM Studio läuft nativ (kein Container).
