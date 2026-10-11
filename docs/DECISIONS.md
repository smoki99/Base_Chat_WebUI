# Entscheidungen

> Wichtige Architektur- und Tooling-Entscheidungen, chronologisch.

| Datum (YYYY-MM-DD) | Entscheidung                                                | Begründung                                                                                             |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2026-10-11         | npm Workspaces statt Yarn/pnpm                              | Einfache, lock-free Pakete; npm ist überall vorinstalliert                                             |
| 2026-10-11         | TypeScript strict + noUncheckedIndexedAccess                | Maximale Typsicherheit, weniger Runtime-Bugs                                                           |
| 2026-10-11         | ESLint flat config + typescript-eslint                      | Moderner Standard (ESLint 9), ein Config für alle Workspaces                                           |
| 2026-10-11         | Prettier als einziger Formatter                             | Separation of Concerns: ESLint = Regeln, Prettier = Styling                                            |
| 2026-10-11         | Gemeinsame Typen in packages/shared                         | Keine Duplizierung, Single Source of Truth                                                             |
| 2026-10-11         | API-Antwortformat `{data}` / `{error:{message}}`            | Konsistenter Vertrag zwischen Web und API                                                              |
| 2026-10-11         | GitHub Actions CI (Node 24, Trigger `master` + `feature/*`) | Automatische typecheck/lint/test/build-Checks auf jedem Push/PR; keine Secrets, selbst-contained Tests |
| 2026-10-11         | MIT-Lizenz                                                  | Open-Source-Standard, maximale Nutzungsfreiheit, `license`-Feld in allen package.json                  |
| 2026-10-11         | Playwright (Chromium, headless) als E2E-Baseline in `apps/web` | UI-Smoke-Test: Website antwortet, React mounted, API-Pfad geprüft; `webServer` startet API+Web mit Readiness, CI-Integration |
