# Story-0008: Rate-Limiting

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `apps/server`
**Review-Befund:** Keine Drosselung – `/api/todos` (POST) ist offen
bruteforce-/spamfähig; `express-rate-limit` ist bereits in den DevDeps,
wird aber nie verwendet.

## Kontext

Ohne Limit können Clients unbegrenzt Todos anlegen oder löschen (DoS auf
dem In-Memory-Store). Die DevDependency `express-rate-limit` liegt bereits
im Workspace – sie fehlt nur im Einsatz.

## Akzeptanzkriterien

- [ ] Rate-Limiter auf `/api/todos` (z. B. 60 req/15 min/IP), konfiguriert
      über `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` aus `.env`
- [ ] Bei Überschreitung: `429` mit JSON-Body `{ "error": "Too many requests" }`
- [ ] `429`-Test in `test/api.test.ts`
- [ ] `apps/server/.env.example` um beide Variablen ergänzt (inkl. Default)

## Tasks

- [ ] `cd apps/server && npm i -D express-rate-limit` → `npm i express-rate-limit` (Produktions-Dep)
- [ ] `src/index.ts`: `rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: {...} })` vor `/api/todos`
- [ ] `.env.example`: `RATE_LIMIT_MAX=60`, `RATE_LIMIT_WINDOW_MS=900000`
- [ ] Test: 41 Requests → 42. Response ist `429`

## Definition of Done

`npm test` grün (inkl. 429-Test); `.env.example` dokumentiert.
