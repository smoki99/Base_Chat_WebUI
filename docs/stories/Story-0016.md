# Story-0016: API-Vertrag als `docs/API.md`

**Status:** ⬜ offen
**Priority:** Low
**Bereich:** `docs/`
**Phase:** 5 – Meta

## Kontext

Die API-Endpunkte sind nur im Code dokumentiert. Eine `docs/API.md`
mit Request/Response-Beispielen erleichtert das Onboarding und die
Nutzung durch externe Konsumenten.

> Kein `openapi-typescript` (bewusste Entscheidung: manueller Doku-Halt,
> kleinerer Fußabdruck).

## Akzeptanzkriterien

- [ ] `docs/API.md` existiert und deckt alle Endpunkte ab: - `GET /api/todos` - `POST /api/todos` - `PATCH /api/todos/:id` - `DELETE /api/todos/:id` - `GET /api/health`
- [ ] Jeder Endpunkt: Method, Path, Request-Body (JSON), Response-Body (JSON),
      HTTP-Status-Codes
- [ ] Fehler-Format: `{ "error": { "message": "…" } }` dokumentiert
- [ ] `README.md`: Link auf `docs/API.md`
- [ ] `docs/API.md` spiegelt den **finalen** API-Zustand (nach 0007, 0012)

## Tasks

- [ ] `docs/API.md` anlegen (alle 5 Endpunkte)
- [ ] `README.md`: Sektion „API" mit Link auf `docs/API.md`
- [ ] Kreuzprüfung: Doku ↔ `apps/api/src/routes/todos.ts` ↔ `packages/shared/src/index.ts`

## Definition of Done

- [ ] `docs/API.md` deckt alle Endpunkte ab
- [ ] `README.md` verweist darauf
- [ ] Doku ist aktuell (spiegelst finalen Zustand)
