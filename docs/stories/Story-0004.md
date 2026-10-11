# Story-0004: Dependency- und Package-Hygiene im Monorepo

**Status:** offen
**Priorität:** Mittel
**Zugehöriger Audit-Befund:** #5, #9, #10

## Kontext

Drei Hygiene-Punkte:

1. `@testing-library/user-event` liegt in `dependencies` von `apps/web`, wird aber nur in Testdateien verwendet → gehört in `devDependencies`.
2. Die Workspaces referenzieren das Shared-Package mit `"shared": "*"` → Versionspinn wäre sauberer und verhindert versehentliche Auflösung aus der Registry.
3. `packages/shared` hat ein `build`-Script (`tsc` → `dist/`), aber `main`/`types` zeigen auf `./src/index.ts` → `dist/` wird von niemandem konsumiert (toter Build-Output).

## Akzeptanzkriterien

1. `@testing-library/user-event` ist in `apps/web` eine `devDependency`; alle Tests laufen weiter.
2. `apps/api` und `apps/web` referenzieren `"shared": "1.0.0"`; `npm ci` auf dem Clean-Checkout löst das Workspace-Package lokal auf.
3. `packages/shared` erzeugt keinen ungenutzten `dist/`-Output: `build`-Script entfernt (oder `main`/`types` zeigen konsistent auf `dist/` und der Build wird Teil der Workspace-Build-Reihenfolge — **Empfehlung: Build-Script entfernen**, da `typecheck` bereits `--noEmit` nutzt und Vite/tsx die Quelle direkt konsumieren).
4. `package-lock.json` wird konsistent aktualisiert und committed.

## Tasks

- [ ] `apps/web/package.json`: `@testing-library/user-event` von `dependencies` in `devDependencies` verschieben
- [ ] `apps/api/package.json` + `apps/web/package.json`: `"shared": "*"` → `"shared": "1.0.0"`
- [ ] `packages/shared/package.json`: `build`-Script entfernen; `tsconfig.json`: `outDir`/`rootDir`-Override prüfen (bei `--noEmit` entbehrlich)
- [ ] Lockfile-Update: `npm install` am Root (Workspaces), Diff sichten
- [ ] `npm run build -w web` weiterhin grün (Vite-Build unverändert)

## Definition of Done

- [ ] `npm ci` auf Clean-Checkout grün
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w web` alle grün
- [ ] `npx knip` am Root ohne neue Befunde
