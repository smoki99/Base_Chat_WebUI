# Story-0020: API-Vertrag als `docs/API.md`

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `docs/`
**Review-Befund:** Der API-Vertrag (Endpoints, Request/Response-Formen,
Error-Codes) ist implizit in `todoRoutes.ts` und `shared/types.ts` –
keine zentrale Dokumentation für externe Konsumenten oder neue Agenten.

## Kontext

Eine `docs/API.md` (oder `openapi.yaml`) macht den API-Vertrag explizit,
testbar (via `openapi-typescript`) und für KI-Agenten leicht konsumierbar.

## Akzeptanzkriterien

- [ ] `docs/API.md`: alle 4 Endpunkte (`GET /api/health`, `GET /api/todos`,
      `POST /api/todos`, `PATCH /api/todos/:id`, `DELETE /api/todos/:id`),
      Request/Response-Beispiele, Error-Formate, Status-Codes
- [ ] `shared/types.ts` und `docs/API.md` stimmen überein (manuelle Prüfung
      oder via `openapi-typescript`-Generierung)
- [ ] `README.md`: Link zu `docs/API.md`
- [ ] `docs/API.md` ist aktuell (nach Story-0013/0014)

## Tasks

- [ ] `docs/API.md` schreiben (aus `todoRoutes.ts` + `shared/types.ts`)
- [ ] `README.md`: Link ergänzen
- [ ] Nach Story-0013: `docs/API.md` mit `zod`-Schemas abgleichen

## Definition of Done

`docs/API.md` existiert, ist aktuell und in der README gelinkt.
