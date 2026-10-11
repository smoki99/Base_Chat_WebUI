# Story-0012: Security-Header (helmet)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `apps/api`
**Phase:** 3 – Quality

## Kontext

Die API liefert keine Security-Header. `helmet` setzt die wichtigsten
(CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, …).
`x-powered-by` ist schon deaktiviert (`app.ts`).
`helmet` ist als neue Dependency freigegeben.

> Hinweis: Für eine reine JSON-API ohne HTML sind CSP/HSTS weniger kritisch.
> `X-Content-Type-Options: nosniff` und `Referrer-Policy` sind hier die
> relevantesten Header.

## Akzeptanzkriterien

- [ ] `apps/api`: `helmet` in `dependencies`
- [ ] `GET /api/health` antwortet mit `X-Content-Type-Options: nosniff`
- [ ] `GET /api/health` antwortet mit `Referrer-Policy: no-referrer`
- [ ] Alle bestehenden Tests bleiben grün
- [ ] Neuer Test: `expect(res.headers['x-content-type-options']).toBe('nosniff')`

## Tasks

- [ ] `cd apps/api && npm i helmet`
- [ ] `src/app.ts`: `app.use(helmet())` vor den Routen mounten
- [ ] `src/__tests__/` (z. B. `security.test.ts`): Header-Assertions ergänzen
- [ ] `npm run typecheck && npm test` grün

## Definition of Done

- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] `X-Content-Type-Options: nosniff` in der `/api/health`-Antwort
- [ ] `Referrer-Policy: no-referrer` in der `/api/health`-Antwort
- [ ] `helmet` in `apps/api/package.json` dependencies
