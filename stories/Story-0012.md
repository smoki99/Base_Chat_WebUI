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
- [ ] `README.md` Quick-Start: `npm run check` als „alle Gates