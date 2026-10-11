# Story-0015: Web-`lib/api.ts` + `useTodos`-Hook

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `apps/web`
**Review-Befund:** `App.tsx` enthält API-Logik (`fetch`, State, Error-Handling)
direkt in der Komponente; keine getrennte `lib/api.ts`, kein wiederverwendbarer
`useTodos`-Hook.

## Kontext

Trennung von „Was ist die API?“ (lib) und „Wie sieht die UI aus?“ (Komponente)
erleichtert Testing, Refactoring und KI-Agenten-Änderungen. `App.tsx` wird
dünn, `lib/api.ts` wird die Single Source of Truth für HTTP-Interaktion.

## Akzeptanzkriterien

- [ ] `apps/web/src/lib/api.ts`: `fetchTodos`, `createTodo`, `toggleTodo`,
      `deleteTodo`, `healthCheck` – alle mit Typen aus `@base/shared`
- [ ] `apps/web/src/hooks/useTodos.ts`: Hook mit `todos`, `loading`, `error`,
      `addTodo`, `toggleTodo`, `deleteTodo`, `retry`
- [ ] `App.tsx` nutzt nur `useTodos` – kein `fetch`, kein `useState` für
      API-Daten
- [ ] `useTodos` hat Unit-Tests (`@testing-library/react` + MSW oder fetch-Mock)
- [ ] `npm run check` grün; E2E (Playwright) weiterhin grün

## Tasks

- [ ] `apps/web/src/lib/api.ts` schreiben (mit `AbortController`-Timeout, 5 s)
- [ ] `apps/web/src/hooks/useTodos.ts` schreiben (mit `useCallback`,
      `useEffect` + `AbortSignal`, Error-Handling, `retry`)
- [ ] `App.tsx` umschreiben
- [ ] `useTodos.test.ts` schreiben
- [ ] E2E-Test prüfen (sollte ohne Änderung funktionieren)

## Definition of Done

`npm run check` + `npm run e2e` grün; `App.tsx` < 60 Zeilen.
