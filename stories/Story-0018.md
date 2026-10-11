# Story-0018: SAST + Secret-Scanning (CodeQL + gitleaks)

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `.github/workflows`
**Review-Befund:** Kein SAST, kein Secret-Scanning in der CI –
veraltete Abhängigkeiten und versehentlich committete Secrets werden
erst spät (oder nie) gefunden.

## Kontext

`npm audit` läuft bereits (via `npm ci` in der CI). Ein CodeQL-Scan für
JS/TS und ein `gitleaks`-Scan für Secrets in der Historie erhöhen die
Sicherheit spürbar.

## Akzeptanzkriterien

- [ ] `.github/workflows/sast.yml`: CodeQL-Scan für `javascript-typescript`
      (auf `push` zu `main` + `pull_request`)
- [ ] `.github/workflows/secrets.yml`: `gitleaks` (via `gitleaks/gitleaks:latest`
      oder `zizhengc/gitleaks-action`) auf `push` + `pull_request`
- [ ] Beide Workflows laufen grün auf `main`
- [ ] `gitleaks`: `.gitignore`-respektierendes Konfigurationsfile
      (`.gitleaks.toml`), Standard-Regeln

## Tasks

- [ ] `sast.yml`: CodeQL-Setup (Node.js-Codebase)
- [ ] `secrets.yml`: `gitleaks`-Action
- [ ] `.gitleaks.toml`: Standard-Config (keine Custom-Regeln nötig)
- [ ] Beide Workflows auf `main` grün

## Definition of Done

`gh run list` zeigt beide Workflows als erfolgreich; keine offenen
CodeQL-/gitleaks-Findings.
