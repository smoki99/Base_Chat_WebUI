# Story-0014: Express 4 → 5

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `apps/server`
**Review-Befund:** Express 4.21.2 ist EOL (Support endet 2025-05); Express 5
ist stabil seit 2024-02. Async-Error-Handling, `req.query`-Proxies und
kleinere Breaking Changes sind in Express 5 gebündelt.

## Kontext

Das Repo nutzt Express 4.21.2. Der Upgrade auf Express 5 bringt
asynchrone Fehlerbehandlung (uncaught Promise-Rejections landen im
Error-Handler), `app.all` statt `app.route`, und eine saubere Basis für
zukunftsfähiges Routing.

## Akzeptanzkriterien

- [ ] `apps/server/package.json`: `"express": "^5.x"`
- [ ] `npm run check` grün (typecheck + lint + test)
- [ ] Alle bestehenden Tests laufen ohne Änderung (außer ggf.
      `req.query`-Typen)
- [ ] `apps/server/src/index.ts`: `app.use(express.json())` bleibt;
      Error-Handler bleibt kompatibel

## Tasks

- [ ] `cd apps/server && npm i express@5`
- [ ] `npm run typecheck && npm test` – bei Fehlern: Typen/Imports anpassen
- [ ] Falls `req.query`-Typen sich ändern: `apps/web` nicht betroffen (Client
      nutzt eigene Typen)

## Definition of Done

`npm run check` grün; `express@5` in `apps/server/package.json`.
