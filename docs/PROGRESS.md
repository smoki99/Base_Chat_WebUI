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

## Offene Punkte / Nächstes Ziel

- [ ] Client-Server-Chat-Flow: `POST /api/chat` + `GET /api/chat` als
      Swap-Punkt für echten Backend/LLM-Anschluss (`chatService.ts`).
- [ ] Persistenz (optional) hinter `chatService` – aktuell in-memory.
- [ ] UX-Details: Auto-Scroll, Markdown/Code-Rendering, Konversations-Historie.
