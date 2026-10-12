# Story: Todo-Logik vollständig aufräumen

**Issue:** https://github.com/smoki99/Base_Chat_WebUI/issues/3
**Branch:** `feature/remove-todo-logic`
**Status:** Offen

## Kontext

Das Projekt wurde von einer Todo-App auf eine Chat-App umgestellt (Story-0017),
aber die Todo-Aufräum-Aufgabe wurde nie abgeschlossen. Die Quelldateien
(`todos.ts`, `TodoList.tsx`, `useTodos.ts`, `todoService.ts`, `api.ts`) wurden
gelöscht, aber **alle Referenzen in App.ts, shared-Typen, Tests und Doku
blieben stehen**. Das Projekt kompiliert aktuell nicht mehr, weil `app.ts`
und `App.tsx` auf nicht mehr existierende Dateien importieren.

## Akzeptanzkriterien

### 1. Kaputte Imports beheben (P0 – Blocker)

- [ ] `apps/api/src/app.ts`: `todoRouter`-Import und `app.use(todoRouter)` entfernen
- [ ] `apps/web/src/App.tsx`: `TodoList`-Import und `<TodoList />`-Rendering entfernen
- [ ] App-Header-Text von „Todo App" auf „Chat App" umstellen

### 2. Verwaiste Typen aus `packages/shared` entfernen

- [ ] `Todo`-Interface aus `packages/shared/src/index.ts` löschen
- [ ] `CreateTodo`-Interface löschen
- [ ] `UpdateTodo`-Interface löschen
- [ ] `ApiResponse`, `ApiError`, `ApiResult`, `isApiError`, `isApiSuccess` bleiben (werden von Chat genutzt)

### 3. Tests auf Chat-Endpoints umstellen

- [ ] `apps/api/src/__tests__/cors.test.ts`: Alle `/api/todos`-Referenzen auf `/api/chat` umstellen
- [ ] `apps/api/src/__tests__/security.test.ts`: `/api/todos`-Test auf `/api/chat` umstellen
- [ ] Alle Tests müssen grün bleiben

### 4. Kommentare bereinigen

- [ ] `apps/api/src/routes/chat.ts` Zeile 37: „consistent with the todos router" → neutralen Kommentar

### 5. Veraltete Build-Artefakte & Coverage aufräumen

- [ ] `apps/api/dist/routes/todos.js` + `.map` → `rm`
- [ ] `apps/api/dist/services/todoService.js` + `.map` → `rm`
- [ ] `apps/api/dist/__tests__/todos.test.js` + `.map` → `rm`
- [ ] `apps/api/dist/__tests__/todos-crud.test.js` + `.map` → `rm`
- [ ] Coverage-HTML-Dateien mit todo-Namen löschen (oder `npm run test` neu ausführen, die Coverage überschreibt)

### 6. Doku aktualisieren

- [ ] `docs/PROGRESS.md`: Status „Todo-Logik aufgeräumt" dokumentieren
- [ ] `docs/ARCHITECTURE.md`: Todo-Beispiele durch Chat-Beispiele ersetzen
- [ ] `docs/DECISIONS.md`: Neuen Eintrag: „Todo-Logik vollständig entfernt"
- [ ] `README.md`: Todo-Beispiele durch Chat-Beispiele ersetzen
- [ ] `.clinerules/*.md`: Todo-Beispiele durch Chat-Beispiele ersetzen (optional, Priorität niedrig)

## Reihenfolge

1. **P0:** Kaputte Imports fixen → `npm run check` muss grün sein
2. **P1:** Verwaiste Typen aus shared entfernen
3. **P1:** Tests umstellen
4. **P2:** Kommentare bereinigen
5. **P2:** Build-Artefakte / Coverage aufräumen
6. **P3:** Doku aktualisieren

## Risiken

- `npm run check` bricht aktuell komplett ab (Importfehler) → Schritt 1 ist Blocker für alles Weitere
- CORS-Tests: `/api/chat` ist ein POST-Endpoint, CORS-Tests nutzen GET und POST → passt
- Security-Tests: `/api/chat` POST braucht ein gültiges Body → Test anpassen
- `packages/shared`: `Todo`-Typen werden aktuell von keinem aktiven Code mehr referenziert → sicher zu löschen

## Definition of Done

- [ ] `npm run check` grün (typecheck + lint + test + build, alle Workspaces)
- [ ] `npm run test:e2e -w web` grün
- [ ] Keine `todo`-Referenzen mehr in `src/` (außer in Doku/Regeln als Beispiel)
- [ ] Kein `Todo`-Typ mehr in `packages/shared`
- [ ] `git log` zeigt saubere, nachvollziehbare Commits

## Geschätzter Aufwand

~30–45 Minuten (einfaches Aufräumen, kein Design-Work)
