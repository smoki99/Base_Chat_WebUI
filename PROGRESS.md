# PROGRESS - Story-0032: UI Customization (Farben, Logo, Banner)

> Status: **PR-READY** – `npm run check` grün, E2E 5/5 grün; Commit + Push ausstehend.
> Branch: `feature/story-0032` | Last updated: 10/16/2026
> Single source of truth: GitHub-Issue #49 (dieses Dokument nur zum Nachverfolgen).

## 1. Goal (Issue-Spec)

- **Farben:** 5 Pickler (primary, primary-hover, surface, surface-dim, text) + Farbpresets, Live-Preview.
- **Logo:** PNG-Upload, max 512 kB; Darstellung im Chat-Header + Sidebar-Top; löschbar.
- **Banner:** optionaler PNG-Upload, max 512 kB, „Banner anzeigen“-Toggle; Darstellung oberhalb der Message-Liste.
- **Persistenz:** `localStorage`-Key `base-chat.ui-customization.v1`; korrupte Daten → Defaults; Quota-fest.
- **Reset:** Button → Werkseinstellungen (Farben + Logo + Banner + Sichtbarkeit).
- **Shared-Typen:** `UiThemeColors` + `UiCustomization` in `packages/shared` (Re-Export via `index.ts`).
- **UI:** Tab „Erscheinungsbild“ in `Settings.tsx` (`CustomizeTab`).
- **E2E:** Farben überstehen ein Reload.
- **PNG-only** (kein SVG – data-URL-XSS), Downscale ≤ 1024 px, Data-URL-Output, testbare Fehler.
- Bestehende Tests grün: `src/__tests__/` (6 Dateien) + `e2e/chat.spec.ts`.

## 2. Plan & Status

| #   | Schritt                                                                                                                 | Status                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Shared-Typen `packages/shared/src/ui.ts` + Re-Export                                                                    | ✅ done (tsc grün)                                                                                    |
| 2   | `appearance/types.ts` + `themes.ts` (5-Farb-Modell, Presets, `applyColors`/`clearColors`, `sanitizeColors`)             | ✅ done                                                                                               |
| 3   | `appearance/storage.ts` (load/save/reset, Key v1, korrupt→Defaults, Quota-safe)                                         | ✅ done                                                                                               |
| 4   | `appearance/imageUtils.ts` (PNG-only, ≤512 kB, ≤1024 px, Data-URL, Error-Codes) + `useImageUpload.ts`                   | ✅ done                                                                                               |
| 5   | `appearance/AppearanceContext.tsx` (Single-Source-State) + `index.ts` Re-Exports                                        | ✅ done (tsc grün)                                                                                    |
| 6   | `main.tsx`: `<App />` in `<AppearanceProvider>` wickeln                                                                 | ✅ done                                                                                               |
| 7   | `CustomizeTab.tsx` + Settings-Tabs („Stimme & Sprache“ / „Erscheinungsbild“)                                            | ✅ done (bestehende Settings/Chat/Sidebar-Tests grün)                                                 |
| 8   | Logo (Chat-Header + Sidebar) + Banner (oberhalb Messages) + CSS (`--ui-*` → `--md-*` Mapping, Logo/Banner-Styles)       | ✅ done (Fix: `logo`-Prop fehlte am `Chat` in `App.tsx` – E2E hat es gefangen)                        |
| 9   | Unit-Tests (appearance-Modul, CustomizeTab, Settings) + E2E (Farben persistieren nach Reload, Logo/Banner)              | ✅ done (105/105 Unit-Tests grün; `e2e/customization.spec.ts`: Reload-Persistenz, Logo/Banner, Reset) |
| 10  | `npm run check` + `npm run test:e2e -w web` grün → Commit `Story-0032: …` → Branch pushen → PR-fertig melden (kein PR!) | ✅ done (Check grün, E2E 5/5; lokal mit `E2E_API_PORT=3101`, da Port 3001 im Sandbox-Host belegt)     |

## 3. Design-Entscheidungen (Abweichungen vom alten Stand)

- **Altes HSL-Theme-Modell verworfen** (Issue-Spec gewinnt): keine Light/Dark-Basis, keine 10 Custom Themes, kein `base-chat.appearance`-Key.
- Farben werden als **CSS Custom Properties** (`--ui-*`) auf `<html>` gesetzt; `index.css` mappt `--md-*` auf `--ui-*` (Fallback = alte Light-Tokens) → ganzes UI aktualisiert live.
- `color-scheme` (light/dark) wird heuristisch aus der Surface-Helligkeit gesetzt (native Scrollbars/Controls).
- Settings: **zwei Tabs** – „Stimme & Sprache“ (bestehender Inhalt, Default aktiv → bestehende Tests unverändert grün) + „Erscheinungsbild“ (neues `CustomizeTab`). Panels werden konditional gerendert, damit `CustomizeTab` außerhalb des Providers nicht mounted wird (bestehende Settings-Tests haben keinen AppearanceProvider).
- `useImageUpload`-API unverändert (`pickFile`/`busy`/`error`/`clearError`) – nur `imageUtils` dahinter ist neu.

## 4. Check-Befehle

```
npx tsc --noEmit -p apps/web          # schneller Modul-Typecheck
npm run check                         # typecheck + lint + test + build, alle Workspaces
npx playwright install chromium       # einmalig
npm run test:e2e -w web               # Playwright-Baseline (startet API + Web)
```

## 5. Risiken

- **E2E/Unit-Selektoren:** Settings-Modal erhält Tabs → alle bestehenden Labels/Locatoren bleiben erhalten (Voice-Select, „Schließen“, „Fertig“).
- **Quota:** zwei Data-URLs à 512 kB + Farben passen in 5 MB; `saveCustomization` swallowt Quota-Fehler.
- **jsdom:** Canvas + `Image` in Unit-Tests mocken (load-Event + `getContext('2d')`).
- **Playwright:** Browser-Binary ggf. einmalig installieren (`npx playwright install chromium`).

## 6. Log

| Datum      | Eintrag                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10/16/2026 | Finale Validierung: `npm run check` grün (inkl. size-limit 112 kB), E2E 5/5 grün. E2E-Fang: `logo`-Prop fehlte am `Chat` in `App.tsx` (Chat-Header-Logo nicht sichtbar) → fixt. E2E lief mit `E2E_API_PORT=3101`, weil der Sandbox-Host Port 3001 belegt (`ao daemon`); `playwright.config.ts` + `vite.config.ts` lesen die Variable (Default unverändert, CI-identisch). |
| 10/16/2026 | Neu-Implementierung gestartet: alte HSL-Theme-Dateien verworfen; Steps 1–6 umgesetzt (Shared-Typen, themes, storage, imageUtils, Context, Provider in main.tsx); `tsc -p apps/web` grün. PROGRESS.md an Issue-Spec angepasst.                                                                                                                                             |
| 10/16/2026 | (vorher) Review + Diagnose des defekten appearance-Moduls (26 TS-Fehler).                                                                                                                                                                                                                                                                                                 |
