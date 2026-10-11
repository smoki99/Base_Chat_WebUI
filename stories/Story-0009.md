# Story-0009: Fail-Closed CORS (Production)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `apps/server`
**Review-Befund:** `cors()` ohne Optionen = `Access-Control-Allow-Origin: *`
in **jeder** Umgebung; in Production ist das nicht gewünscht.

## Kontext

`apps/server/src/index.ts` mountet `cors()` global ohne Konfiguration. Für
ein Boilerplate ist das in Dev akzeptabel, in Production sollte die
Allowed-Origin konfiguriert und standardmäßig **geschlossen** sein
(fail-closed, nicht `*`).

## Akzeptanzkriterien

- [ ] `apps/server/.env.example` enthält `CORS_ORIGIN=http://localhost:5173`
      (Vite-Dev-Port) und `NODE_ENV=development` als Kommentar
- [ ] Production: keine `Access-Control-Allow-Origin`-Header auf `/api/*`
      außer `CORS_ORIGIN` ist gesetzt (dann exakt diese Origin)
- [ ] Dev-Default: `CORS_ORIGIN` gesetzt → genau diese Origin wird erlaub
- [ ] Tests: (a) ohne `CORS_ORIGIN` → keine CORS-Header, (b) mit
      `CORS_ORIGIN=http://localhost:5173` → exakt dieser Header

## Tasks

- [ ] `src/index.ts`: `const origin = process.env.CORS_ORIGIN; app.use(origin ? cors({ origin, credentials: true }) : cors())` – oder: ohne Origin → `cors()` weglassen (empfohlen: fail-closed)
- [ ] Tests in `test/api.test.ts` (mit `NODE_ENV`/`CORS_ORIGIN`-Mock via
      `vi.stubEnv` oder Test-Setup)
- [ ] `.env.example` ergänzen

## Definition of Done

`npm test` grün; Production-Szenario (leere Env) hat keine
`Access-Control-Allow-Origin`-Header.
