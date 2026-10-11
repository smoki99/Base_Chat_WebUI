# Story-0001: Einheitliche Validierung bei POST und PATCH

**Status:** offen
**Priorität:** Hoch
**Zugehöriger Audit-Befund:** #1 (leerer Titel), #3 (nicht-boolean `done`)

## Kontext

`apps/api/src/todoService.ts` validiert `createTodo` (leerer Titel → Fehler),
aber `updateTodo` nicht:

- `if (input.title !== undefined) todo.title = input.title.trim();`
  → `PATCH /api/todos/:id` mit `{"title": "   "}` liefert 200 und speichert einen leeren Titel.
- `if (input.done !== undefined) todo.done = input.done;`
  → akzeptiert beliebige Werte (z. B. `"yes"`), obwohl `UpdateTodo.done` vom Typ `boolean` ist.

POST und PATCH sollen dieselben Validierungsregeln haben.

## Akzeptanzkriterien

1. **Given** eine existierende Todo **When** `PATCH /api/todos/:id` mit `{"title": "   "}` (oder nur Leerzeichen/Tab) **Then** `400 Bad Request` mit `{ "error": { "message": ... } }`, die Todo wird nicht verändert.
2. **Given** eine existierende Todo **When** `PATCH /api/todos/:id` mit `{"done": "yes"}` **Then** `400 Bad Request` mit `{ "error": { "message": ... } }`, die Todo wird nicht verändert.
3. **Given** eine existierende Todo **When** `PATCH` mit `{"title": "Neuer Titel"}` bzw. `{"done": true}` **Then** `200` und die Änderungen werden gespeichert (bestehendes Verhalten bleibt erhalten).
4. Fehlermeldungen sind deutsche Strings im bestehenden Stil (z. B. „Title darf nicht leer sein.“, „Done muss ein boolean Wert sein.“).
5. Die Validierung läuft **vor** jeder Mutation des Todo-Objekts (all-or-nothing).

## Tasks

- [ ] `todoService.ts`: `updateTodo` um Validierung ergänzen (Title-Check nur wenn `title` mitgegeben wird; `done`-Typcheck nur wenn `done` mitgegeben wird)
- [ ] `todoService.ts`: Fehlersituationen über denselben Fehlerpfad wie `createTodo` (400) werfen
- [ ] `todoService.test.ts`: Testfälle für leeren Titel und nicht-boolean `done` bei PATCH ergänzen
- [ ] Bestehende CRUD-Tests unverändert lassen

## Definition of Done

- [ ] `npm test -w api` grün
- [ ] `npm run typecheck` und `npm run lint` grün
- [ ] API-Antwortformat `{data}` / `{error:{message}}` unverändert
