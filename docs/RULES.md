# KI-Regeln (Projekt: myapp)

> Kanonische Regeln für alle KI-Agenten (Cline, Copilot, etc.).
> Diese Datei wird bei jedem Agent-Run automatisch geladen.

---

## 1. Sprache

- Antworte auf **Deutsch**.
- Code & Kommentare auf **Englisch**.

## 2. Arbeitsweise

- Kleine Schritte. **Eine Aufgabe = eine kohärente Änderung.**
- Vor Änderungen: **relevante Dateien LESEN**, nichts annehmen.
- Keine neuen Dependencies ohne Rückfrage.
- Bei Unsicherheit: **Frage stellen** statt raten.

## 3. Qualitäts-Gate (vor JEDEM Commit)

> NIE „fertig" melden oder committen, ohne vorher **ALLE** Checks erfolgreich ausgeführt zu haben:

```bash
npm run check   # typecheck + lint + test + build – alle Workspaces, bricht bei erstem Fehler ab
```

**Warum `build`?**
Die CI (`npm run build --workspaces`) erwartet ein `build`-Script in JEDEM Workspace.
Ein fehlendes Script bricht den CI-Loop – auch wenn typecheck/lint/test grün sind.

**Zusätzlich bei E2E-relevanten Änderungen:**

```bash
npx playwright install chromium   # einmalig, Browser-Binaries
npm run test:e2e -w web
```

## 4. CI-Parität

> **Bevor** der erste Commit in einem neuen Feature-Branch erfolgt:

1. `.github/workflows/ci.yml` **lesen**
2. Alle CI-Schritte lokal abbilden (mind. die vier Pflicht-Checks oben)
3. Falls neue CI-Schritte hinzugekommen sind: lokal testen

**Grundregel:** Was in der CI läuft, muss lokal grün sein – und umgekehrt.

## 5. Architektur

- Gemeinsame Typen/DTOs **immer** in `packages/shared` – nie duplizieren.
- API-Antworten: `{ "data": ... }` oder `{ "error": { "message": ... } }`.
- `apps/api`: Routen in `src/routes/`, Logik in `src/services/`.
- `apps/web`: holt Daten via `fetch` (URL aus `VITE_API_URL`).

## 6. Git & Commits

- **Conventional Commits**: `type(scope): subject`
  - Typen: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`
  - Scope: optional – `(api)`, `(web)`, `(shared)`
  - Subject: kurz, aktiv, **deutsch**, max. ~70 Zeichen
- Body (optional): nur bei nicht selbst-erklärenden Änderungen, Zeilen max. ~100 Zeichen.
- Beispiele:
  - `feat(api): todo-Validierung für POST und PATCH hinzufügen`
  - `fix(shared): build-Script als No-Op für CI-Workspace-Loop ergänzen`
  - `chore: ESLint-Config auf flat config migrieren`

## 7. Security & Config

- **Keine Secrets im Code.**
- Config kommt aus `.env` (Vorlage: `.env.example`).
- `npm audit --omit=dev --audit-level=high` vor jedem Merge.

## 8. Dokumentation

- Wichtige Entscheidungen → `docs/DECISIONS.md` (Datum · Entscheidung · Begründung).
- Fortschritt → `docs/PROGRESS.md`.
- Architektur → `docs/ARCHITECTURE.md`.

## 9. Monorepo-Konventionen

- **Jeder Workspace** (`apps/*`, `packages/*`) muss die Pflicht-Scripts haben:
  - `typecheck`
  - `lint`
  - `test`
  - `build` (No-Op `echo '...'` erlaubt für Source-only-Pakete)
- Root-Scripts nutzen `--workspaces` – ein fehlendes Script in EINEM Workspace
  bricht den gesamten Loop.

---

_Letzte Aktualisierung: 2026-10-11_
