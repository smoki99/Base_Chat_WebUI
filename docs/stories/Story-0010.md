# Story-0010: SAST + Secret-Scanning (CodeQL + gitleaks)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `.github/workflows/`
**Phase:** 2 – CI-Hygiene

## Kontext

Keine statische Analyse und kein Secret-Scanning in der CI. CodeQL für
JS/TS und `gitleaks` decken zwei häufige Schwachstellen ab.

## Akzeptanzkriterien

- [ ] Neue Workflow `security.yml`: CodeQL (JavaScript/TypeScript) + gitleaks
- [ ] Läufe auf `pull_request` und `push` zu `master`
- [ ] `timeout-minutes` pro Job (max. 15)
- [ ] Gitleaks: `fail: true` bei Funden

## Tasks

- [ ] `.github/workflows/security.yml` anlegen (CodeQL + gitleaks)
- [ ] `gitleaks`-Step: `docker run --rm -v $(pwd):/data zricethezra/gitleaks detect --source /data --fail`
- [ ] Push → Security-Workflow grün

## Definition of Done

- [ ] `security.yml` existiert und ist syntaktisch gültig
- [ ] CodeQL + gitleaks laufen auf PRs
- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
