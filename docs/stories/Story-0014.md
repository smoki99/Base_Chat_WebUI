# Story-0014: Web – `lib/api.ts` + `useTodos`-Hook

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `apps/web/src/`
**Phase:** 4 – Web

## Kontext

`TodoList.tsx` enthält API-Aufrufe, State-Management und Render-Logik in
einer Komponente (~150 Zeilen). Eine Trennung in `lib/api.ts` (reine
API-Funktionen) und `hooks/useTodos.ts` (State + Logik) macht die
Komponente testbar und wiederverwendbar.

> Hinweis: Story-0013 (Double-Submit) muss **vor** dieser Story stehen,
> damit der Inflight-Guard beim Refactor erhalten bleibt.

## Akzeptanzkriterien

- [ ] `apps/web/src/lib/api.ts`: `fetchTodos`, `createTodo`, `toggleTodo`,
      `deleteTodo` – reine Fetch-Funktionen, keine React-Imports
- [ ] `apps/web/src/hooks/useTodos.ts`: Hook mit `todos`, `loading`,
      `error`, `addTodo`, `toggleTodo`, `deleteTodo`
- [ ] `TodoList.tsx`: nur noch Render-Logik, nutzt `useTodos()`
- [ ] Alle bestehenden Unit-Tests + E2E-Tests bleiben grün
- [ ] Neue Unit-Tests für `lib/api.ts` (Mock-Fetch)

## Tasks

- [ ] `apps/web/src/lib/api.ts` anlegen (API-Funktionen aus `TodoList.tsx` extrahieren)
- [ ] `apps/web/src/hooks/useTodos.ts` anlegen (State + Logik)
- [ ] `TodoList.tsx` schlank machen (nur Render)
- [ ] `src/__tests__/api.test.ts`: Unit-Tests für `lib/api.ts`
- [ ] `npm run typecheck && npm test` grün
- [ ] `npm run test:e2e -w web` grün

## Definition of Done

- [ ] `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] `TodoList.tsx` enthält keine `fetch`-Aufrufe
- [ ] `npm run test:e2e -w web` grün
- [ ] `lib/api.ts` und `useTodos.ts` existieren und sind getestet
