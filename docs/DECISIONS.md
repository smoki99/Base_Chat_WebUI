# Entscheidungen

> Wichtige Architektur- und Tooling-Entscheidungen, chronologisch.

| Datum | Entscheidung | Begründung |
|-------|-------------|------------|
| 2026-11-10 | npm Workspaces statt Yarn/pnpm | Einfache, lock-free Pakete; npm ist überall vorinstalliert |
| 2026-11-10 | TypeScript strict + noUncheckedIndexedAccess | Maximale Typsicherheit, weniger Runtime-Bugs |
| 2026-11-10 | ESLint flat config + typescript-eslint | Moderner Standard (ESLint 9), ein Config für alle Workspaces |
| 2026-11-10 | Prettier als einziger Formatter | Separation of Concerns: ESLint = Regeln, Prettier = Styling |
| 2026-11-10 | Gemeinsame Typen in packages/shared | Keine Duplizierung, Single Source of Truth |
| 2026-11-10 | API-Antwortformat `{data}` / `{error:{message}}` | Konsistenter Vertrag zwischen Web und API |
