# Story-0013: Validierungs-Schemas (zod) in `packages/shared`

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `packages/shared`, `apps/server`
**Review-Befund:** Server-Validierung ist ad-hoc (`typeof`-Checks in
`todoRoutes.ts`); kein wiederverwendbares Schema; Client und Server
duplizieren Typen manuell.

## Kontext

`packages/shared` liefert nur Typen. Ein `zod`-Schema als Single Source of
Truth für Request/Response-Formen reduziert Duplikation und macht
Validierung deklarativ.

## Akzeptanzkriterien

- [ ] `packages/shared`: `npm i zod`; `src/schemas.ts` mit
      `TodoCreateSchema`, `TodoSchema`, `TodosResponseSchema`
- [ ] `apps/server`: `todoRoutes.ts` validiert mit `TodoCreateSchema.parse(...)`
      (oder `.safeParse` + saubere 400-Response)
- [ ] `apps/web`: `lib/api.ts` nutzt `TodoSchema` für Runtime-Checks (optional,
      aber empfohlen)
- [ ] Tests: ungültige Payloads (`title` fehlt, `title` leer, `completed` nicht
      boolean) → `400` mit `{ "error": "Validation failed" }`

## Tasks

- [ ] `cd packages/shared && npm i zod`
- [ ] `src/schemas.ts` schreiben, `index.ts` exportieren
- [ ] `apps/server/src/routes/todoRoutes.ts`: `safeParse`-Pattern
- [ ] `apps/web/src/lib/api.ts` (siehe Story-0015): `TodoSchema.parse` auf
      Responses
- [ ] Tests in `apps/server/test/api.test.ts`

## Definition of Done

`npm run check` grün; Runtime-Validierung für alle 3 Endpunkte.
