# Progress Log

> Chronologisches Log der Storys und Etappen. Neueste Einträge oben.
> Single Source of Truth für Story-Inhalte: GitHub Issues (`Story-XXXX: …`).

## Projektziel (aktuell)

**Chat-Webseite mit Daten-Admin** – moderne Web-Chat-Oberfläche (React 19)
mit Express-Backend, gemeinsamen Typen in `packages/shared`, Voice über den
`voz`-Sidecar, UI-Customization (Themes/Logo/Banner) und einem Admin-Panel:
Excel/CSV-Import nach PostgreSQL, Schema-Vorschau, CSV/XLSX-Export und
MCP-Tools (`qmd`, `sql`, `admin-db`) als Chat-Tools.

Zustand: Story-0034 (Postgres-Admin, PR #57), Story-0035 (MCP-Chat-Export,
Issue #56) und Story-0036 (Custom-Prompt, PR #61) abgeschlossen.
Nächste Ziele: Offene Punkte unten (Admin-Edge-Cases, Persistenz).

## Story-Überblick

| Story | Thema                                                                                                       | Status         |
| ----- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| 1–8   | Boilerplate, CI, Shared-DTOs, API, Chat-UI, E2E, Docs, Voice                                                | ✅             |
| 29–33 | Qualitäts-Tore (size-limit, knip, dependency-cruiser), UI-Customization (Themes, Logo, Banner), Chat-Export | ✅             |
| 34    | Postgres-Admin: MCP `admin-db` (read-only) + CSV/XLSX-Tabelle-Export                                        | ✅ (PR #57)    |
| 35    | MCP-Chat-Export: `export_table`-Tool + einmalige Download-Links im Chat                                     | ✅ (Issue #56) |
| 36    | Eigener Chatbot-Prompt: Prompt-Erweiterung in den Einstellungen (serverseitig)                              | ✅ (PR #61)    |

> Details zu 29–33: `docs/DECISIONS.md` (Story-0032 UI-Customization u. a.).

## Log

### Story 1–7: Boilerplate & Fundament

- ✅ npm Workspaces: `apps/web` (React 19 + Vite), `apps/api` (Express),
  `packages/shared` (Typen/DTOs).
- ✅ `npm run check` = typecheck + lint + test + build in allen Workspaces.
- ✅ GitHub-Actions-CI: `check` + `e2e`-Job (Playwright).
- ✅ `packages/shared`: DTOs `ChatMessage` / `CreateChatMessage`.
- ✅ `apps/api`: Health-Check + API-Form `{ data }` / `{ error }`.
- ✅ `apps/web`: `Chat`-Komponente (Nachrichten senden/empfangen, Empty-State).
- ✅ Playwright-E2E: API-Health + Web-Interaktion.
- ✅ Docs: `README.md`, `API.md`, `ARCHITECTURE.md`, `RULES.md`, `DECISIONS.md`.

### Story 8: Voice (TTS + STT + Hands-free)

- ✅ Python-Sidecar `apps/voz` (FastAPI): Edge-TTS (Online) + Whisper (lokal).
- ✅ API: `GET /api/voice/capabilities`, `POST /api/voice/tts`, `POST /api/voice/stt`.
- ✅ Web: `useVoice.ts` – TTS-Playback, STT-Aufnahme, Hands-free-Modus.
- ✅ Hands-free: RMS-Noise-Floor-Kalibrierung (500 ms), EMA-Adaption,
  10-ms-Detection-Loop, Auto-Pause während TTS.
- ✅ Anti-Self-Hearing: 500 ms Post-TTS-Cooldown, synchrones `isSpeakingRef`,
  100 ms Speech-Debounce, 300 ms Min-Aufnahmedauer, 15 s Max.
- ✅ Sprachabhängige Acknowledgment-Phrasen (`acknowledgments.json`, de/en/es).
- ✅ TTS-Retry bei HTTP 403/500 (Edge-TTS-Token-Ablauf).
- ✅ StrictMode-Double-Effect-Guard (`processedTranscriptRef`).
- ✅ Tests: `voice-client.test.ts`, `voice-routes.test.ts`.

### Story 29–33: Qualitäts-Tore & UI-Customization

- ✅ `size-limit` (Bundle-Budget web, aktuell 112 kB brotli), `knip`
  (Unused-Exports), `dependency-cruiser` (Circular-Import-Detection) im Check.
- ✅ Story-0032: UI-Customization komplett client-seitig – Themes (5
  Hex-Farben + Presets), Logo & Banner (PNG/SVG, validiert, ≤ 512 kB),
  Storage-Key `base-chat.ui-customization` in `localStorage`.
- ✅ Port-Migration 3001 → 4001 (API-Default, Vite-Proxy, E2E, Doku).
- Details: `docs/DECISIONS.md`.

### Story-0034: Postgres-Admin (MCP + Export)

- ✅ Phase 3: MCP-Server `admin-db` (`scripts/admin-db-mcp-server.mjs`) mit
  Tools `list_tables`, `search_tables`, `run_sql`; `run_sql` strikt
  read-only via `admin-sql-guard.mjs` + `SET TRANSACTION READ ONLY`.
- ✅ Phase 4: Tabelle-Export `GET /api/admin/tables/:name/export` (CSV/XLSX),
  Cap `ADMIN_EXPORT_MAX_ROWS` (Default 10000), CSV mit UTF-8-BOM + RFC-4180,
  XLSX via `exceljs`; UI-Buttons im Admin-Preview-Header, Download per Blob.
- ✅ 14 neue Tests (Escapes, BOM, XLSX-Round-Trip, 400/404/403, Cap).
- ✅ Doku-Sync: `README.md`, `docs/API.md` (Admin-Referenz),
  `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`.
- PR: #57 · Issue: #53.

### Story-0035: MCP-Chat-Export (einmalige Download-Links)

- ✅ **Architektur (Abweichung von Issue #56):** On-Demand-Generierung statt
  Temp-Dateien + Cleanup-Job – gemeinsame Postgres-Registry
  `public.admin_exports` (Token, Tabelle, Format, Limit, TTL, `redeemed_at`);
  Datei wird beim ersten Request generiert. Read-only bleibt gewahrt.
- ✅ **MCP:** neues Tool `export_table` im `admin-db`-Server
  (Validierung Format/Tabelle/Limit, Registry-Eintrag, liefert Markdown-Link
  für den Chat, `API_BASE_URL` aus Env).
- ✅ **API:** `GET /api/admin/exports/:token` – UUID-Selbsttoken als
  Authentifizierung (kein Bearer), `404` unbekannt, `410` bereits genutzt oder
  abgelaufen (TTL 15 Min), `Content-Disposition: attachment`,
  `adminService.exportTable` wiederverwendet.
- ✅ **Web:** keine Änderung nötig – `Markdown.tsx` rendert Links bereits als
  `<a target="_blank">` (Vite-Proxy bzw. nginx in Produktion).
- ✅ Tests: 6 MCP-stdio-Tests (Validierung, Link, Registry-SQL, Cleanup,
  Tools/list) + 6 Route-Tests (404/410/200 CSV+XLSX, Limit, `redeemed`);
  Smoke-Test gegen echtes Postgres: MCP-Call → 200 CSV → 410 → 410 (expired)
  → 404.
- ✅ Doku-Sync: `README.md`, `docs/API.md` (neuer Endpunkt),
  `docs/DECISIONS.md` (On-Demand + Einmaligkeit/TTL).
- Issue: #56.

### Story-0036: Eigener Prompt für den Chatbot

- ✅ Status: implementiert (2026-10-17) – GitHub-Issue #60 (`Story-0036: …`)
  ist Single Source of Truth. Prompt-Erweiterung in den Einstellungen (neuer
  Tab „Chatbot-Prompt“), serverseitige Persistenz auf dem Filesystem
  (gemeinsam für alle Nutzer, nie localStorage), Datei in `.gitignore`;
  der Text wird dem LLM-Systemprompt hinzugefügt (Hilfe bei
  Begrifflichkeiten importierter Tabellen/Spalten).
- Entscheidungen (2026-10-17): Auth über das **gleiche `ADMIN_TOKEN`** wie
  die Admin-Routen (eigene Token-Prüfung `requireAdminToken`, ohne
  `DATABASE_URL`-Pflicht); Dateipfad
  `apps/api/data/chatbot-custom-prompt.md` (Override:
  `CHATBOT_CUSTOM_PROMPT_FILE`); Max-Länge **20 000 Zeichen** (→ `400`).
- Umsetzung: shared-DTOs + `customPromptStore` (atomares Schreiben) +
  `GET/PUT /api/chat/custom-prompt` (Supertest) + Provider-Abschnitt
  `## Additional instructions` (vor der Voice-Anweisung) + chatService
  lädt den Prompt pro Request + Web-Tab mit Editor, Zeichen-Zähler,
  Speichern/Zurücksetzen, Statusanzeige + Doku-Sync (README, API.md,
  DECISIONS.md).
- Tests: API `custom-prompt.test.ts` (Store, Routen, Wiring) +
  Provider-Tests; Web `PromptTab.test.tsx` + `Settings.test.tsx`.
- Issue: #60.

### Doku-Release (2026-10-17)

- ✅ Doku-Audit gegen Code & Config, danach Sync: `README.md`,
  `docs/API.md` (Chat-`history`-Feld, Voice-Beispiele),
  `docs/ARCHITECTURE.md` (Shared-Typen, api/web-Struktur, Dev-Proxy),
  `docs/RULES.md`, `.clinerules/main.md`, `.env.example`.
- ✅ `VITE_API_URL` aus Doku & Env-Vorlage entfernt – in keinem Code-Pfad
  genutzt; der Browser nutzt relative `/api/*`-Pfade (dev: Vite-Proxy,
  Override `E2E_API_PORT`; prod: Reverse-Proxy).
- ✅ Root `PROGRESS.md` auf einen Arbeits-Log-Stub minimiert (Vorlage:
  Ziel/Steps/Status-Log bei jeder neuen Story befüllen); das dauerhafte
  Projekt-Log bleibt `docs/PROGRESS.md`, ältere Story-Logs in der Git-Historie.

## Offene Punkte / Nächstes Ziel

- [ ] Admin: weitere Typableitungen/Edge-Cases beim Import (z. B. Datumsformate).
- [ ] UX-Details: Konversations-Historie über Session-Grenzen (Persistenz).
