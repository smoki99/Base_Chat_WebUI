# Story-0006: `npm run check` (ein Befehl für alle Gates)

**Status:** ✅ erledigt
**Priority:** High
**Bereich:** `package.json` (root)
**Phase:** 1 – Fundament

## Kontext

Agenten und Entwickler müssen `typecheck`, `lint`, `test` und `build` separat
aufrufen. Ein aggregierter `check`-Skript ist klarer und fehlerärmer.
Das Repo nutzt `npm run … --workspaces` (kein `turbo`).

## Akzeptanzkriterien

- [x] `package.json` (root) bekommt:
      `"check": "npm run typecheck && npm run lint && npm test && npm run build"`
- [x] `npm run check` führt alle 4 Gates in allen Workspaces aus und bricht
      bei erstem Fehler ab
- [x] `README.md` Quick-Start: `npm run check` als „alle Gates"
- [ ] `AGENTS.md` (Story-0015): `npm run check` als Hauptbefehl

## Tasks

- [x] Root `package.json`: `check`-Skript ergänzen
- [x] `README.md`: Quick-Start aktualisieren
- [x] Test: `npm run check` lokal ausführen → grün

## Definition of Done

- [x] `npm run typecheck && npm run lint && npm test && npm run build`
- [x] `npm run check` führt alle 4 Gates in allen Workspaces aus
- [x] README und (später) AGENTS.md verweisen darauf
