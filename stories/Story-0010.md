# Story-0010: CI – Least Privilege, Timeout, Concurrency

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `.github/workflows/ci.yml`
**Review-Befund:** `permissions` fehlen; `timeout-minutes` fehlt;
`concurrency` fehlt → parallele Runs für dieselbe Branch verschwenden
Minuten und können stale werden.

## Kontext

Der CI-Run nutzt das Default-GITHUB_TOKEN mit breiten Rechten (wenn nicht
global restricted). Für ein Read-only-Repo genügt `contents: read`.

## Akzeptanzkriterien

- [ ] `permissions: contents: read` auf Job-Ebene
- [ ] `timeout-minutes: 10`
- [ ] `concurrency: group: ci-${{ github.ref }}`, `cancel-in-progress: true`
      (nur für `pull_request`/`push` auf `main` relevant; für Forks bleibt es
      harmlos)
- [ ] CI läuft weiterhin grün (lokale Dry-Run-Äquivalenz: `npm run check` + `npm run e2e`)

## Tasks

- [ ] `ci.yml`: `permissions`, `timeout-minutes`, `concurrency` ergänzen
- [ ] PR-Trigger-Check: Workflow läuft für PRs aus Forks mit `pull_request`
      (nicht nur `pull_request_target`) – falls nötig dokumentieren

## Definition of Done

`actionlint` (falls verfügbar) oder manuelle Prüfung: keine Syntax-/Semantic-Fehler;
CI auf dem PR grün.
