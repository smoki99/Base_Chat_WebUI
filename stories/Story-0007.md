# Story-0007: Security-Header (helmet)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `apps/server`
**Review-Befund:** Kein `helmet`, keine eigenen Security-Header; `app.disable('x-powered-by')` fehlt.

## Kontext

Die Express-App setzt keinerlei Security-Header (X-Content-Type-Options,
X-Frame-Options, Referrer-Policy, CSP …) und liefert `X-Powered-By: Express`
als Fingerprint.

## Akzeptanzkriterien

- [ ] `helmet` in `apps/server` installiert und in `src/index.ts` vor den
      Routes gemountet
- [ ] `app.disable('x-powered-by')`
- [ ] `apps/web/index.html` wird als **nicht** in einem Frame eingebettet
      gemeldet (`X-Frame-Options: DENY` bzw. `frame-ancestors 'none'` via
      helmet-CSP-Option)
- [ ] Test: `GET /api/health` enthält `x-content-type-options: nosniff`,
      `referrer-policy: no-referrer`, `x-powered-by` ist nicht vorhanden

## Tasks

- [ ] `cd apps/server && npm i helmet`
- [ ] `src/index.ts`: `import helmet from 'helmet'`, `app.use(helmet())`,
      `app.disable('x-powered-by')`
- [ ] `test/api.test.ts`: Header-Test ergänzen

## Definition of Done

`cd apps/server && npm run lint && npm test` grün; Header in der
Test-Antwort verifiziert.
