# Story-0006: Double-Submit-Prävention (Add + Delete)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `apps/web`
**Review-Befund:** `addTodo()` und `deleteTodo()` senden ohne Guard – doppeltes
Absenden (Doppelklick, zweifacher Enter) erzeugt doppelte Todos bzw. zwei
identische DELETE-Requests; `deleteTodo` nutzt den captured `id`, nicht den
aktuellen Zustand.

## Kontext

`useTodos.ts` sendet jeden `addTodo()`-Aufruf ungefiltert an die API. Ein
schneller Doppelklick auf „Add