# Progress Log

> Chronologisches Log der Storys und Etappen. Neueste Einträge oben.

## Projektziel (aktuell)

**Chat-Webseite** – eine moderne Web-Chat-Oberfläche mit Client (React 19)
und Server (Express), angebunden über REST, getrennt durch gemeinsame Typen
in `packages/shared`.

Zustand: Boilerplate-Baseline steht (Monorepo, CI, E2E, Docs). Der
Client-Server-Chat-Flow (Nachrichten senden/empfangen, `chatService` als
Swap-Punkt für echten Backend/LLM-Anschluss) ist das nächste Ziel.

## Story-Überblick

| Story | Thema                                                    | Status |
| ----- | -------------------------------------------------------- | ------ |
| 1     | Boilerplate & Monorepo-Setup                             | ✅     |
| 2     | CI/CD & Qualitäts-Tore (typecheck · lint · test · build) | ✅     |
| 3     | Shared-DTOs (`ChatMessage` / `CreateChatMessage`)        | ✅     |
| 4     | API: Health-Check & API-Form `{ data } / { error }`      | ✅     |
| 5     | Web: `Chat`-Komponente (Nachrichtenfluss)                | ✅     |
| 6     | E2E-Suite (Playwright)                                   | ✅     |
| 7     | Docs (API, Architektur, Rules)                           | ✅     |
| 8     | Voice: TTS + STT + Hands-free (voz-Sidecar)              | ✅     |

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

## Offene Punkte / Nächstes Ziel

- [ ] Client-Server-Chat-Flow: `POST /api/chat` + `GET /api/chat` als
      Swap-Punkt für echten Backend/LLM-Anschluss (`chatService.ts`).
- [ ] Persistenz (optional) hinter `chatService` – aktuell in-memory.
- [ ] UX-Details: Auto-Scroll, Markdown/Code-Rendering, Konversations-Historie.
