# Story-0002: CORS-Verstöße mit 403 statt 500 melden

**Status:** offen
**Priorität:** Hoch
**Zugehöriger Audit-Befund:** #2

## Kontext

In `apps/api/src/app.ts` wird ein unerlaubter Origin so abgewiesen:

```ts
callback(new Error('Not allowed by CORS'));
```

Der zentrale Error-Handler sieht keine `status`-Eigenschaft → antwortet mit
`500 Internal server error`. Semantisch ist ein CORS-Verstoß ein Client-Fehler
(`403 Forbidden`). Der bestehende Test maskiert das, weil er nur `status >= 400` prüft.

## Akzeptanzkriterien

1. **Given** eine Anfrage mit disallowtem `Origin` **When** sie `POST /api/todos` erreicht **Then** `403 Forbidden` mit `{ "error": { "message": ... } }`.
2. **Given** ein Preflight (`OPTIONS`) mit disallowtem `Origin` **Then** `403 Forbidden` (kein `Access-Control-Allow-Origin`-Header).
3. Erlaubte Origins (inkl. `*` und `localhost:5173` im Dev-Default) verhalten sich wie bisher: `200` bzw. erfolgreiche Preflight-Antwort.
4. Die Fehlermeldung gibt keine internen Details preis.

## Tasks

- [ ] `app.ts`: CORS-Fehler mit Status 403 markieren (typsicher, z. B. `Object.assign(new Error('CORS: Origin nicht erlaubt'), { status: 403 })` oder kleine `HttpError`-Klasse)
- [ ] Zentralem Error-Handler ggf. expliziten Fall für `err.status === 403` prüfen/sichern
- [ ] `app.test.ts`: CORS-Tests von `status >= 400` auf exakt `403` verschärfen (beide Fälle: normal + Preflight)
- [ ] Bestehende Erfolgscases (erlaubte Origin, `*`) unverändert lassen

## Definition of Done

- [ ] `npm test -w api` grün (inkl. verschärfter 403-Assertions)
- [ ] `npm run typecheck` und `npm run lint` grün
