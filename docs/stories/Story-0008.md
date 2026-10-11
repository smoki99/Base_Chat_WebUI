# Story-0008: Prettier-Check in CI

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** Root, CI
**Phase:** 2 – CI-Hygiene

## Kontext

`.prettierrc.json` und das `format`-Skript (`prettier --write .`) existieren
schon im Repo. Es fehlt der `format:check`-Skript und der CI-Step.

## Akzeptanzkriterien

- [ ] Root `package.json`: `"format:check": "prettier --check ."`
- [ ] `.prettierignore`: `node_modules`, `dist`, `coverage`, `package-lock.json`
- [ ] CI: neuer Step „Format" → `npm run format:check`
- [ ] Bestehender Code ist formatiert (einmaliges `npm run format`)

## Tasks

- [ ] `package.json`: `format:check`-Skript ergänzen
- [ ] `.prettierignore` anlegen
- [ ] `npm run format` einmalig ausführen
- [ ] `ci.yml`: Step „Format" nach „Setup" einfügen
- [ ] `npm run format:check` → exit 0

## Definition of Done

- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] `npm run format:check` grün
- [ ] CI: Format-Step erfolgreich
