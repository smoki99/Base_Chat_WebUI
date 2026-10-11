# Story-0012: `npm run check` (ein Befehl)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `package.json` (root)
**Review-Befund:** Agenten müssen `typecheck`, `lint` und `test` separat
aufrufen; ein aggregierter `check`-Skript fehlt.

## Kontext

Für KI-Agenten (und Menschen) ist ein einziger Befehl, der alle Gates
ausführt, klarer und fehlerärmer. `turbo` läuft bereits über die
Workspaces.

## Akzeptanzkriterien

- [ ] `package.json` (root) bekommt: `"check": "turbo run typecheck lint test"`
- [ ] `npm run check` führt `typecheck`, `lint` und `test` in allen
      Workspaces aus und bricht bei erstem Fehler ab
- [ ] `README.md` Quick-Start: `npm run check` als "alle Gates"
- [ ] `AGENTS.md` (Story-0011): `npm run check` als Hauptbefehl
- [ ] CI: separate Steps optional durch `npm run check` ersetzen
      (siehe Story-0010)

## Tasks

- [ ] Root `package.json`: `check`-Skript ergänzen
- [ ] `README.md`: Quick-Start aktualisieren
- [ ] Test: `npm run check` lokal ausführen → grün

## Definition of Done

`npm run check` führt alle Gates in allen Workspaces aus; README und
AGENTS.md verweisen darauf.
