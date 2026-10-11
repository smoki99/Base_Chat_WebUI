# Projekt: myapp
Stack: TypeScript (strict) Monorepo, npm Workspaces.
apps/web = React 19 + Vite (nur UI) · apps/api = Express (REST) · packages/shared = gemeinsame Typen.

## Regeln für dich (KI) – HART
1. Antworte auf Deutsch, Code & Kommentare auf Englisch.
2. Kleine Schritte. Eine Aufgabe = eine kohärente Änderung.
3. Vor Änderungen: relevante Dateien LESEN, nichts annehmen.
4. Keine neuen Dependencies ohne Rückfrage.
5. NIE "fertig" melden, ohne vorher erfolgreich ausgeführt zu haben:
   `npm run typecheck` · `npm run lint` · `npm test`
6. Keine Secrets im Code. Config kommt aus .env (Vorlage: .env.example).
7. Bei Unsicherheit: Frage stellen statt raten.
8. Git: Conventional Commits (feat:, fix:, chore:), kurzer deutscher Subject.

## Architektur
- Gemeinsame Typen/DTOs immer in packages/shared definieren, nie duplizieren.
- API-Antworten immer in Form: { "data": ... } oder { "error": { "message": ... } }.
- apps/api: Routen in src/routes/, Logik in src/services/.
- apps/web: holt Daten über fetch von der API (URL aus VITE_API_URL).

## Befehle
- dev: npm run dev (web + api parallel)
- tests: npm test · typecheck: npm run typecheck · lint: npm run lint

## Memory
- Wichtige Entscheidungen (Stack-Choice, Abweichungen) dokumentierst du
  in docs/DECISIONS.md als Eintrag: Datum · Entscheidung · Begründung.
