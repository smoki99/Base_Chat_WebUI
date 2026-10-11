# Story-0007: Express 4 → 5

**Status:** ✅ erledigt
**Priority:** Medium
**Bereich:** `apps/api`
**Phase:** 1 – Fundament

## Kontext

Das Repo nutzt Express `^4.21` (Maintenance Mode). Express 5 ist stabil seit
2024-02 und bringt asynchrones Fehlerhandling (uncaught Promise-Rejections
landen im Error-Handler), sauberes `req.query`-Typing und eine zukunftsfähige
Basis.

## Akzeptanzkriterien

- [x] `apps/api/package.json`: `"express": "5.3.0"`
- [x] `npm run typecheck && npm run lint && npm test && npm run build` grün
- [x] Alle bestehenden Tests laufen ohne Änderung
- [x] `apps/api/src/app.ts`: `express.json()`, CORS und Error-Handler bleiben kompatibel

## Tasks

- [x] `cd apps/api && npm i express@5`
- [x] `npm run typecheck && npm test` – bei Fehlern: Typen/Imports anpassen
- [x] Lockfile aktualisieren

## Definition of Done

- [x] `npm run typecheck && npm run lint && npm test && npm run build`
- [x] `express@^5` in `apps/api/package.json`
- [x] Alle 41 Tests grün
