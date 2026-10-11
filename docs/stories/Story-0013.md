# Story-0013: Double-Submit-Prävention (Add + Delete)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `apps/web/src/components/TodoList.tsx`
**Phase:** 4 – Web

## Kontext

Story-0003 hat bereits einen `inFlight`-Ref für `handleToggle` eingeführt.
`handleAdd` und `handleDelete` haben noch kein Guard – ein Doppelklick
kann doppelte Todos anlegen oder Race-Conditions bei Delete verursachen.

## Akzeptanzkriterien

- [ ] Doppelklick auf „Add" (gleicher Titel) → exakt **ein** neuer Todo
- [ ] Doppelklick auf „Delete" (gleicher Todo) → exakt **ein** Delete-Request
- [ ] Nach Abschluss (Erfolg oder Fehler) sind Add/Delete sofort wieder klickbar
- [ ] E2E: Doppelklick-Test grün

## Tasks

- [ ] `TodoList.tsx`: bestehenden `inFlight`-Ref auf `handleAdd` und
      `handleDelete` erweitern (gleiche Pattern wie `handleToggle`)
- [ ] `TodoList.test.tsx`: 2 neue Tests (Add-Doppelklick, Delete-Doppelklick)
- [ ] E2E: Doppelklick-Szenario abdecken

## Definition of Done

- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] `npm run test:e2e -w web` grün
- [ ] `TodoList.tsx`: Add und Delete haben Inflight-Guard
