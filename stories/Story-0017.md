# Story-0017: Prettier-Check in CI

**Status:** ⬜ offen
**Priority:** Medium
**Bereich:** `.github/workflows/ci.yml`, `package.json`
**Review-Befund:** `eslint` läuft in CI, aber `prettier` (Formatierung) wird
nicht geprüft – inkonsistente Formatierung bleibt unbemerkt.

## Kontext

`prettier` ist bereits in den DevDeps (root). Ein `prettier --check` in der
CI stellt sicher, dass die Formatierung konsistent bleibt.

## Akzeptanzkriterien

- [ ] `package.json` (root): `"format:check": "prettier --check ."` und
      `"format": "prettier --write ."`
- [ ] `ci.yml`: neuer Step `Run: npm run format:check` (vor `npm run check`)
- [ ] `.prettierrc.json` (oder `.prettierrc`) existiert und deckt alle
      Dateien ab (`"semi": true, "singleQuote": true, "trailingComma": "es5"`)
- [ ] CI: `format:check` läuft und ist grün

## Tasks

- [ ] `.prettierrc.json` erstellen (falls nicht vorhanden)
- [ ] `package.json`: Scripts ergänzen
- [ ] `ci.yml`: Step ergänzen
- [ ] `npm run format` (einmalig, um bestehende Dateien zu formatieren)

## Definition of Done

`npm run check` + `npm run format:check` grün; CI zeigt den Step.
