# Story-0005: CI- und Supply-Chain-Härtung (Dependabot + E2E-Artifacts)

**Status:** erledigt
**Priorität:** Mittel
**Zugehöriger Audit-Befund:** #6, #7

## Kontext

1. Es existiert kein `.github/dependabot.yml` — Dependencys und Actions werden nicht automatisch gepatcht. Für ein Base-Repo, das als Grundlage vieler Projekte dient, ist das ein Sicherheitsblindspot.
2. Bei fehlgeschlagenen Playwright-Läufen im CI gibt es keine Artefakte (`playwright-report/`, `test-results/`) → Fehlersuche erfordert lokalen Re-Run.

## Akzeptanzkriterien

1. Dependabot ist konfiguriert:
   - `npm`-Ökosystem, Wurzelverzeichnis `/`, wöchentlicher Check
   - `github-actions`-Ökosystem, wöchentlicher Check
2. Bei einem fehlgeschlagenen CI-Lauf ist ein Artifact mit `playwright-report/` (und `test-results/`) verfügbar.
3. Bei erfolgreichen Läufen entstehen keine (unnötigen) Artefakte; `continue-on-error` so, dass fehlende Pfade den Lauf nicht brechen.
4. Der Workflow bleibt syntaktisch gültig und läuft im CI grün.

## Tasks

- [x] `.github/dependabot.yml` anlegen:

      ```yaml
      version: 2
      updates:
        - package-ecosystem: npm
          directory: /
          schedule:
            interval: weekly
        - package-ecosystem: github-actions
          directory: /
          schedule:
            interval: weekly
      ```

- [x] `ci.yml`: nach dem E2E-Step Artifact-Upload ergänzen (Version an die im Repo verwendete `actions/*`-Generation anpassen, z. B. v4+):

      ```yaml
      - name: Upload Playwright report (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 30
          if-no-files-found: ignore
      ```

- [x] Workflow lokal validieren (z. B. `actionlint` oder GitHub-UI)

## Definition of Done

- [x] `.github/dependabot.yml` committed
- [x] CI-Lauf grün; bei simuliertem E2E-Failure ist das Artifact im Actions-Tab sichtbar
- [x] Keine Änderung am Test-Code oder an den Dependencies
