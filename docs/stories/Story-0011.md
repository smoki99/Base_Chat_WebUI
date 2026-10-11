# Story-0011: Vitest-Coverage mit Schwellwert

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `apps/api`, `apps/web`
**Phase:** 3 – Quality

## Kontext

Tests existieren, aber die Abdeckung ist unklar. Ein Coverage-Report mit
Schwellwert verhindert, dass neue Code-Pfade ungetestet bleiben.
`@vitest/coverage-v8` ist als neue Dependency freigegeben.

## Akzeptanzkriterien

- [ ] `apps/api` und `apps/web`: `@vitest/coverage-v8` in `devDependencies`
- [ ] Vitest-Config: `coverage: { provider: 'v8', lines: 80, functions: 80 }`
- [ ] `npm run test` zeigt Coverage-Report (Terminal + `coverage/`-Ordner)
- [ ] Coverage unter 80 % → CI rot

## Tasks

- [ ] `cd apps/api && npm i -D @vitest/coverage-v8`
- [ ] `cd apps/web && npm i -D @vitest/coverage-v8`
- [ ] Vitest-Config (beide Apps): Coverage-Optionen ergänzen
- [ ] `npm test` in beiden Apps → Coverage-Report erscheint
- [ ] Ggf. fehlende Tests ergänzen, bis 80 % erreicht

## Definition of Done

- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] Coverage ≥ 80 % (lines + functions) in beiden Apps
- [ ] `coverage/`-Ordner in `.gitignore`
