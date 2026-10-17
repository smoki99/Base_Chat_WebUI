# Progress Log

> Chronologisches Log der Storys und Etappen. Neueste Einträge oben.
> Single Source of Truth für Story-Inhalte: GitHub Issues (`Story-XXXX: …`).

## Projektziel (aktuell)

**Chat-Webseite mit Daten-Admin** – moderne Web-Chat-Oberfläche (React 19)
mit Express-Backend, gemeinsamen Typen in `packages/shared`, Voice über den
`voz`-Sidecar, UI-Customization (Themes/Logo/Banner) und einem Admin-Panel:
Excel/CSV-Import nach PostgreSQL, Schema-Vorschau, CSV/XLSX-Export und
MCP-Tools (`qmd`, `sql`, `admin-db`) als Chat-Tools.

Zustand: Story-0034 abgeschlossen (Postgres-Admin inkl. MCP `admin-db`
und CSV/XLSX-Export, PR #57). Nächstes Ziel: Story-0035 (MCP-Chat-Export,
Issue #56).

## Story-Überblick

| Story | Thema                                                                                                       | Status         |
| ----- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| 1–8   | Boilerplate, CI, Shared-DTOs, API, Chat-UI, E2E, Docs, Voice                                                | ✅             |
| 29–33 | Qualitäts-Tore (size-limit, knip, dependency-cruiser), UI-Customization (Themes, Logo, Banner), Chat-Export | ✅             |
| 34    | Postgres-Admin: MCP `admin-db` (read-only) + CSV/XLSX-Tabelle-Export                                        | ✅ (PR #57)    |
| 35    | MCP-Chat-Export: `export_table`-Tool + einmalige Download-Links im Chat                                     | ✅ (Issue #56) |
| 36    | Eigener Chatbot-Prompt: Prompt-Erweiterung in den Einstellungen (serverseitig)                              | 🟡 vorbereitet |

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

### Story-0036: Eigener Prompt für den Chatbot (vorbereitet)

- 🟡 Status: vorbereitet – GitHub-Issue #60 (`Story-0036: …`) ist Single
  Source of Truth. Ziel: Prompt-Erweiterung in den Einstellungen (neuer
  Tab „Prompt"), serverseitige Persistenz auf dem Filesystem (gemeinsam
  für alle Nutzer, nicht localStorage), Datei in `.gitignore`; der Text
  wird dem LLM-Systemprompt hinzugefügt (Hilfe bei Begrifflichkeiten
  importierter Tabellen/Spalten).
- 10 Steps (Details im Issue #60):
  1. shared-DTOs (`CustomPrompt`, `UpdateCustomPrompt`, `MAX_CUSTOM_PROMPT_CHARS`).
  2. Store-Service `customPromptStore.ts` (atomares Schreiben, Env-Override, Tests).
  3. `.gitignore` (`apps/api/data/`) + `.env.example` (Datei nie im Git-Index).
  4. Routen `GET/PUT /api/chat/custom-prompt` (Validierung, Supertest).
  5. Provider: `ReplyOptions.customPrompt` + Abschnitt `## Additional instructions`.
  6. chatService-Wiring (Custom-Prompt pro Request laden).
  7. Web: neuer Settings-Tab „Prompt“ (Editor, Zeichen-Zähler, Speichern, Status).
  8. Web-API-Client (`fetchCustomPrompt` / `saveCustomPrompt`).
  9. Doku-Sync (README, API, DECISIONS, PROGRESS).
  10. `npm run check` + E2E grün, Conventional Commits, PR-Bereitschaft.
- Offene Fragen (bei GO): Auth (Default: ohne Token), Dateipfad, Max-Länge.

## Offene Punkte / Nächstes Ziel

- [ ] Admin: weitere Typableitungen/Edge-Cases beim Import (z. B. Datumsformate).
- [ ] UX-Details: Konversations-Historie über Session-Grenzen (Persistenz).
- [ ] Story-0036: Eigener Prompt für den Chatbot – vorbereitet (Issue #60), wartet auf GO.
