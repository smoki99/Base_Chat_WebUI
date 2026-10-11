# Story-0009: CI – timeout-minutes + concurrency

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `.github/workflows/ci.yml`
**Phase:** 2 – CI-Hygiene

## Kontext

`permissions` ist schon gesetzt (`contents: read`, `actions: write`).
Es fehlen noch `timeout-minutes` und `concurrency` in `ci.yml`.

## Akzeptanzkriterien

- [ ] `ci.yml`: `timeout-minutes: 15` auf Job-Ebene
- [ ] `ci.yml`: `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
- [ ] CI bleibt grün nach Änderung

## Tasks

- [ ] `ci.yml`: `timeout-minutes: 15` unter `jobs.ci` ergänzen
- [ ] `ci.yml`: `concurrency`-Block ergänzen
- [ ] Push → CI läuft, zweiter Push auf denselben Branch cancelt den ersten

## Definition of Done

- [ ] `ci.yml` enthält `timeout-minutes` und `concurrency`
- [ ] CI-Run erfolgreich
- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
