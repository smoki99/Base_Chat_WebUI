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
schneller Doppelklick auf „Add" oder zweifaches Drücken von Enter erzeugt
doppelte Einträge. `deleteTodo(id)` nutzt die zum Zeitpunkt des Klicks
gelesene `id` – bei sehr schnellen Folgeaktionen kann das zu Race-Conditions
führen (z. B. Delete eines schon gelöschten Todos → 404).

## Akzeptanzkriterien

- [ ] `addTodo()` ist idempotent pro Text: während ein `fetch` läuft, werden
      weitere Aufrufe mit demselben Titel ignoriert (kein zweiter Request)
- [ ] `deleteTodo(id)` ist idempotent: ein zweiter Klick auf dasselbe Todo
      erzeugt keinen zweiten `DELETE`-Request (State-Check oder `Set` von
      in-flight IDs)
- [ ] UI: Button „Add" ist bei leerem Titel `disabled`; nach Absenden bleibt
      er für die Dauer des Requests in `aria-busy="true"`
- [ ] Test: doppelter `addTodo('x')` → exakt ein `fetch`-Aufruf
- [ ] Test: doppelter `deleteTodo(id)` → exakt ein `fetch`-Aufruf

## Tasks

- [ ] `apps/web/src/hooks/useTodos.ts`: `inFlight = useRef<Set<string>>(new Set())`
      für Add-Keys (`add:<lowercased-title>`) und Delete-Keys (`del:<id>`);
      Guard am Anfang jeder Funktion
- [ ] `App.tsx`: `aria-busy` auf Add-Button während Request
- [ ] `App.test.tsx`/`useTodos.test.ts`: Idempotenz-Tests ergänzen

## Definition of Done

`npm run check` grün; neue Tests laufen; E2E (`todos.spec.ts`) bleibt grün.
