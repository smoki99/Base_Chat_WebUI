# Progress

> Plan & Fortschritt, chronologisch. Neueste Einträge zuerst.
> Status: ✅ fertig · 🔄 in Arbeit · ⬜ offen · ⛔ blockiert

## Ziel

Interaktiver „Click-Dummy“ als TypeScript + React-Boilerplate:
Todo-App mit **komplettem CRUD** (Add / Toggle / Delete), **Bootstrap +
Material Design** Styling und einer schönen Startseite. Vollständig
getestet (Unit + E2E) und CI- grün.

## Plan (Etappen)

| # | Etappe | Status |
|---|--------|--------|
| 1 | Progress-Datei anlegen | ✅ |
| 2 | Bootstrap (v5) im Web-Workspace installieren | ✅ |
| 3 | Shared-DTOs (`CreateTodo` / `UpdateTodo`) | ✅ |
| 4 | API: CRUD-Endpunkte (POST / PATCH / DELETE) | ✅ |
| 5 | API-Tests (Vitest + Supertest) | ✅ |
| 6 | Web: Bootstrap-Import + Material-Design-CSS | ✅ |
| 7 | Web: interaktive `TodoList` (Add / Toggle / Delete) | ✅ |
| 8 | Web-Unit-Tests (RTL) | ✅ |
| 9 | E2E: Interaktionen (Playwright) | ✅ |
| 10 | Docs: README + DECISIONS + `.vscode` aufräumen | ✅ |
| 11 | Full-Chain (typecheck/lint/test/e2e) + Commit | ✅ |

## Changelog

### 2026-10-11 — Interaktivität + Bootstrap Material Design

- Bootstrap v5 (CSS) im Web-Workspace installiert, Material-3-Styling
  (Roboto, Elevation, Primary-Farbe) via `src/index.css`.
- `packages/shared`: DTOs `CreateTodo` / `UpdateTodo` ergänzt.
- API (in-memory CRUD):
  - `POST /api/todos` → 201 `{ data: Todo }` (Validierung: `title` non-empty)
  - `PATCH /api/todos/:id` → 200 `{ data: Todo }` (Toggle / Umbenennen)
  - `DELETE /api/todos/:id` → 204 (Unknown-ID → 404 ApiError)
- Web: `TodoList` interaktiv (Add-Form, Checkbox-Toggle, Delete-Button),
  Start-Page als Material-Card.
- Tests: API-CRUD (Unit) + Web-Interaktion (RTL) + E2E (Add/Toggle/Delete).
- Docs: README + DECISIONS aktualisiert, `.vscode/extensions.json`
  Tailwind-Empfehlung entfernt.
