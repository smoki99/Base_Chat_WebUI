# PROGRESS – Story: Postgres-Verwaltung (Admin-UI + Import/Export + Verknüpfungen + MCP-Chat)

> **Status: Phase 0 ✅ · Phase 1 (API ohne Export) ✅ · Phase 2 (Admin-UI) ✅ · Phasen 3–4 ⏳ – `npm run check` + E2E grün (17.10.2026)**
> Workspace: AO-Session `base_chat_webui-7` · Basis `master` @ `c6a234e7`
> Single Source of Truth: GitHub-Issue (Schritt 1). Dieses Dokument: Nachverfolgung + Status-Log.

## Status-Log (neueste oben)

| Zeit (UTC)   | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17.10. 06:30 | **Phase 2 (Admin-UI) fertig:** `AdminPanel.tsx` (Tabellen-Liste/-Vorschau/-Löschen, Excel/CSV-Import, FK-Relationen CRUD) + `Sidebar`-Button (🗄️) + `App.tsx`-Wiring. **Alles grün:** `npm run check` ✅ (API 122 Tests, Web 132 Tests, Coverage API 90,63 %, Build, size-limit 114,05 kB < 120 kB), E2E 6/6 ✅. API-Lint-Fixes: SonarJS (CSV-Parser-Split, `\W`, superlineare Regex, multer-Limit), exceljs-`Buffer`-Typkonflikt via `Parameters<>`-Cast, Knip-Exports entfernt. |
| 16.10. 19:41 | **Status-Check (Workspace):** Phase 0 ✅ (Deps, env, pgPool). Phase 1 ⚠️ teilweise: Shared-Typen (Teilmenge), tables-Service (list + preview), list/preview-Routen, `requireAdmin` (403/403/503). **Kritisch:** `apps/api/test/adminApi.test.ts` (9 Tests) nicht von Vitest abgedeckt → `npm run test -w api` / `npm run check` rot (Coverage 68,06 % < 80 %). Erst-Next: Test nach `src/__tests__/` verschieben. Phasen 2–4 ⏳. Änderungen noch uncommitted.                     |
| 16.10.       | Plan-Finalisierung: E2E-Abgrenzung lokal/CI (Schritte 10, 23), API-Base relativ unter Playwright (Schritt 11), Risiken 9–11, §7-Entscheidungen vermerkt.                                                                                                                                                                                                                                                                                                                          |
| 16.10.       | **Freigabe: GO Phasen 0–4** (Phase 5 auf Abruf). Implementierung gestartet.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 16.10.       | Plan erstellt (27 Schritte, 6 Phasen), wartete auf Freigabe.                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Status (16.10.2026 19:41 UTC – im Workspace verifiziert)

| Schritt | Inhalt                          | Status | Anmerkungen                                                                                                                                                                                 |
| ------- | ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Story/Branch                    | ✅     | Story-0034 (Issue #53), Branch `ao/base_chat_webui-7/postgres-admin`                                                                                                                        |
| 2       | Dependencies (api)              | ✅     | `exceljs` 4.4.0, `multer` 2.4.0, `@types/multer` 2.3.0; Lockfile aktualisiert                                                                                                               |
| 3       | pgPool                          | ✅     | `apps/api/src/services/pgPool.ts` (lazy Pool, `PgQueryable`, `setPoolForTests`, `closePool()` im Shutdown) – **Pfad weicht vom Plan ab** (`src/db/pool.ts`)                                 |
| 4       | Shared-Typen                    | ✅     | `packages/shared/src/admin.ts`: `AdminTable`, `AdminTableColumn`, `AdminTablePreview`, Import-/Relation-DTOs; Re-Export via `index.ts`                                                      |
| 5       | tables-Service                  | ✅     | `apps/api/src/services/adminService.ts`: `listTables()`, `previewTable()`, `deleteTable()` (Identifier-Whitelist, LIMIT 1–100)                                                              |
| 6       | import-Service                  | ✅     | `parseCsv` (RFC-4180), XLSX via `exceljs`, Typ-Infektion (`inferType`), `importTable` (PK = erste Spalte), 122 API-Tests grün, Coverage 90,63 %                                             |
| 7       | export-Service                  | ⏳     | noch offen (nicht in Scope dieser Session)                                                                                                                                                  |
| 8       | links-Service                   | ✅     | FK-Relationen CRUD (`listRelations`, `createRelation`, `deleteRelation`) inkl. FK-Constraint-Anlage/-Löschung                                                                               |
| 9       | Routen + Admin-Token            | ✅     | 7 Endpunkte unter `/api/admin/*` (list, preview, delete, import, relations GET/POST/DELETE); `requireAdmin` (403/503); `multer` 25-MB-Limit (memoryStorage)                                 |
| 10      | API-E2E (Postgres)              | ⏳     | API-Logik per fakes in `src/__tests__/adminApi.test.ts` abgedeckt (122 Tests); echte DB-E2E mit `DATABASE_URL`-Guard noch offen                                                             |
| 11–15   | Phase 2 – Admin-UI (Web)        | ✅     | `AdminPanel.tsx` (Tabs Tabellen/Relationen: Liste, Vorschau, Löschen, Import, Relationen-CRUD) + `Sidebar`-Button (🗄️, `onOpenAdmin`) + `App.tsx`-State; 16 Panel-Tests + Sidebar-Test grün |
| 16–19   | Phase 3 – MCP-Chat              | ⏳     |                                                                                                                                                                                             |
| 20–24   | Phase 4 – Qualität/Docs/Release | ⏳     |                                                                                                                                                                                             |
| 25–27   | Phase 5 – Follow-ups            | ⏸      | nur auf Abruf                                                                                                                                                                               |

**✅ Aufgelöst (17.10.2026):** Die 9-Test-Datei liegt jetzt in `apps/api/src/__tests__/adminApi.test.ts` (122 Tests grün, Coverage > 80 %). `npm run check` + `npm run test:e2e -w web` (6/6) sind grün; size-limit 114,05 kB < 120 kB.

**Nächster Schritt:** Phase 3 (MCP-Chat-Tools: `list_tables`, `search_tables`, `run_sql` read-only) und/oder Schritt 7 (Export-Service) – jeweils mit eigenem Scope.

## 1. Ziel

Über einen **Verwaltungs-Button** (Sidebar) öffnet sich ein **Modal-Dialog** mit einer Postgres-SQL-Datenbank-Verwaltung:

- **Tabellenübersicht**: alle aktuell existierenden Tabellen (inkl. bestehender `product`).
- **Import**: CSV, XLSX, TSV (+ optional ODS) → neue Tabelle. Beim Import wird die **Primary-Key-Spalte** festgelegt: **Default = erste Spalte**, alternativ **generierte ID** oder keine PK.
- **Export**: jede Tabelle als CSV und XLSX.
- **Löschen**: Tabelle inkl. abhängiger Constraints/FKs.
- **Logische Verknüpfungen**: Tabellen per IDs/Fremdschlüsseln (1:1, 1:n, m:n) verknüpfen.
- **MCP-SQL-Chat**: importierte Tabellen sind im Chat sichtbar, **durchsuchbar** und per Tool abfragbar.

## 2. Ausgangszustand (master @ c6a234e7)

| Baustein              | Status                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`            | Express REST, `product`-CRUD, `DATABASE_URL` in `.env.example`, Tests Vitest                                                        |
| `apps/web`            | React 19 + Vite, Sidebar (Farben/Logo/Banner aus Story-0032), `VITE_API_URL`                                                        |
| `apps/mcp-sql-server` | MCP-Server (TypeScript, stdio): Tools `search_products`, `get_product`; Chat-Tools nur mit echtem LLM (openai-kompatibel)           |
| `packages/shared`     | gemeinsame Typen (`Product`, `ChatMessage` …)                                                                                       |
| CI                    | 4 Pflicht-Checks + `npm audit` (critical), `npm audit signatures`, `verify-lockfile.cjs`, `knip`, `depcheck`, eigener `sql-mcp`-Job |

## 3. Ziel-Architektur

```
apps/web (React)
  └─ Admin-Button (Sidebar) → AdminDialog (Modal)
       ├─ Tab "Tabellen": Liste, Vorschau, Import, Export, Löschen
       └─ Tab "Verknüpfungen": FK-Links 1:1 / 1:n, Brückentabellen m:n
apps/api (Express)
  ├─ src/db/pool.ts        → pg.Pool (lazy, env DATABASE_URL)
  ├─ src/routes/admin.ts   → /api/admin/* (API-Surface unten)
  └─ src/services/admin/   → tables, import, export, links
apps/mcp-sql-server
  └─ neue Tools: list_tables, search_tables, run_sql (read-only)
packages/shared
  └─ Admin-DTOs (AdminTable, ImportPlan, Link …)
```

## 4. API-Surface (neu, `apps/api`)

| Methode & Pfad                                        | Zweck                                             |
| ----------------------------------------------------- | ------------------------------------------------- |
| `GET /api/admin/tables`                               | alle Tabellen: Name, Zeilen, Größe, PK, erstellt  |
| `GET /api/admin/tables/:name/preview?limit=50`        | Zeilen-Vorschau (sanitisiert)                     |
| `POST /api/admin/tables/import/plan`                  | Datei → Spalten + Typ-Vorschau (schreibt nichts)  |
| `POST /api/admin/tables/import`                       | Datei + PK-Option → Tabelle anlegen (Transaktion) |
| `GET /api/admin/tables/:name/export?format=csv\|xlsx` | Download                                          |
| `DELETE /api/admin/tables/:name`                      | Tabelle löschen                                   |
| `GET /api/admin/links`                                | vorhandene Verknüpfungen (`pg_constraint`)        |
| `POST /api/admin/links`                               | 1:1/1:n-FK anlegen; `type=m2n` → Brückentabelle   |
| `DELETE /api/admin/links/:id`                         | Verknüpfung entfernen                             |

Fehlerformat konsequent: `{ "error": { "message": "…" } }` (Architektur-Regel).

## 5. Schritt-für-Schritt-Plan (27 Schritte, 6 Phasen)

### Phase 0 – Fundament (2 Schritte)

1. **GitHub-Issue anlegen** `Story-00XX: Postgres-Verwaltung (Admin-UI + Import/Export + Links + MCP-Chat)`, Feature-Branch `feature/story-00XX` (oder Session-Branch weiterverwenden). Vorab `.github/workflows/ci.yml` prüfen, dass alle CI-Schritte lokal abgedeckt sind (Regel 9).
2. **Dependencies für `apps/api`**: `pg` (Postgres-Client), `exceljs` (XLSX – npm-`xlsx`@0.18.5 hat Critical-Advisories und würde das `npm audit`-CI-Gate blockieren), `multer` (Multipart-Upload). Gate vor Commit: `npm audit --audit-level=critical`, `npm audit signatures`, `knip`, `depcheck` grün. Entscheidung in `docs/DECISIONS.md` dokumentieren.

### Phase 1 – Datenlayer API (8 Schritte)

3. **`apps/api/src/db/pool.ts`**: `pg.Pool`-Singleton (env `DATABASE_URL`), lazy Init, `query()`-Helper, Timeouts; injizierbarer Pool für Unit-Tests.
4. **`packages/shared/src/admin.ts`**: DTOs `AdminTable`, `AdminColumn`, `ImportPlan`, `ImportOptions`, `ImportResult`, `ExportFormat`, `LinkSpec`, `LinkInfo`; in `index.ts` exportieren. (Gemeinsame Typen nur in `shared` – Architektur-Regel.)
5. **`services/admin/tables.ts`**: `listTables()` (information_schema + `pg_class.reltuples`, `pg_size_pretty`, PK-Spalte) und `getTablePreview()` (Identifier-Whitelist, quoted Identifiers, LIMIT); Unit-Tests mit Fake-Pool.
6. **`services/admin/import.ts`**: CSV/TSV-Parser (Delimiter, Quotes) + XLSX-Reader (exceljs), **Typ-Inferenz** (integer/float/boolean/date/text), `CREATE TABLE` + `COPY` in Transaktion; **PK-Strategien**: (a) gewählte Spalte als PK (Default: erste Spalte, mit Uniqueness-Check), (b) generierte ID (`uuid default gen_random_uuid()`), (c) ohne PK; bei Fehler Rollback + Temp-Table aufräumen; Tests: Parser, Typ-Inferenz, PK-Logik.
7. **`services/admin/export.ts`**: Tabellen-Stream → CSV (RFC 4180) & XLSX (exceljs), Zeilen-Limit (z. B. 100k) mit Warnung; Tests.
8. **`services/admin/links.ts`**: `addLink()` → Daten-Validierung (alle Werte im Ziel vorhanden), dann `ALTER TABLE … ADD CONSTRAINT … REFERENCES`; `listLinks()` aus `pg_constraint`; `removeLink()`; **m:n**: `createBridgeTable(a, b)` (Brückentabelle + 2 FKs + Unique-Constraint); Tests mit Fake-Pool.
9. **`routes/admin.ts` + Mount in `app.ts`**: alle Endpunkte aus §4; File-Upload via `multer` (25-MB-Limit); Fehlerformat `{ error: { message } }`; **Admin-Token** (Header `x-admin-token`, env `ADMIN_TOKEN`; Token fehlt → Admin-Routen mit 403) als minimales Auth (Risiko 1, Entscheidung §7); Supertest-Tests mit Fake-Pool.
10. **API-E2E** (`apps/api/test/admin.e2e.ts`): gegen echte Postgres (Docker `postgres:16`, Label `ao.session=$AO_SESSION_ID`): CSV importieren → Tabelle vorhanden → Preview → CSV- & XLSX-Export → FK-Link → m:n-Brücke → `DELETE` → Tabelle weg. **Nur lokal** – CI hat keinen Postgres-Service (Risiko 10); in der CI automatisch übersprungen (`describe.skipIf(!process.env.DATABASE_URL)`), lokal mit Docker-Postgres läuft.

### Phase 2 – Admin-UI `apps/web` (5 Schritte)

11. **`src/admin/api.ts`**: typisierter Fetch-Client für §4 (Base `VITE_API_URL`), Fehler-Normalisierung, `FormData`-Upload. **Kein hartcodierter `localhost:3000`-Fallback** – unter Playwright (Web-Port 4173) muss die API-Basis relativ bleiben (`/api`), sonst bricht das E2E-Szenario 23.
12. **`src/admin/AdminDialog.tsx`**: Modal (Focus-Trap, Esc schließt, `role="dialog"`, `aria-modal`); Tabs **Tabellen** / **Verknüpfungen**; **Verwaltungs-Button** (Zahnrad-Icon, `aria-label="Verwaltung"`) in der Sidebar.
13. **`src/admin/TablesTab.tsx`**: Tabellen-Liste (Name, Zeilen, Größe, PK, erstellt) + Aktionen **Vorschau / Export CSV / Export XLSX / Löschen** (doppelte Bestätigung: Tabellenname tippen); leere Zustände + Fehler-Toasts.
14. **`src/admin/ImportDialog.tsx`**: Dateiauswahl (CSV/XLSX/TSV) → Schritt 1: Spalten- & Typ-Vorschau (`/import/plan`) → Schritt 2: **PK-Frage** als Radio-Gruppe `[Erste Spalte (Default)] [Neue ID generieren (uuid)] [Ohne PK]` + Spalten-Picker → Import → Erfolgs-/Fehlermeldung; jsdom-Tests.
15. **`src/admin/LinksTab.tsx`**: bestehende Links (Von → Nach, Typ) + Formular (Quell-Tabelle/-Spalte, Ziel-Tabelle/-Spalte, Typ 1:1 / 1:n, m:n → Brückentabelle) + Löschen; jsdom-Tests.

### Phase 3 – MCP-SQL-Chat (4 Schritte)

16. **Katalog-Tools**: `list_tables()` (alle Tabellen, inkl. importierter) und `search_tables(query)` (Tabellen- + Spaltennamen durchsuchen) als neue MCP-Tools; `search_products` / `get_product` bleiben unverändert (CI-Job `sql-mcp` prüft sie!).
17. **`run_sql(query)`-Tool**: strikt **read-only** (Server blockt Non-SELECT + read-only-Transaktion) – damit sind importierte Tabellen im Chat direkt abfragbar.
18. **Chat-Systemprompt** (`apps/api` chatService): bei verbundener Postgres-DB verfügbare Tabellen + Spalten in den Systemprompt aufnehmen; MockProvider unverändert (Chat bleibt ohne LLM-Key eingeschränkt).
19. **Chat-E2E-Flow**: importierte Tabelle im MCP-Chat testen („Zeige alle Zeilen von X", „Welche Spalten hat Y?") → Tools feuern → Ergebnis in der UI. (Manuell mit echtem LLM; CI prüft nur die Tool-Registration.)

### Phase 4 – Qualität, Docs, Release (5 Schritte)

20. **Docs**: `docs/DECISIONS.md` (pg, exceljs, Admin-Token, PK-Strategie), README (Admin-Sektion + neue `.env`-Variablen), `.env.example` um `ADMIN_TOKEN` ergänzen.
21. **UI-Polish**: Loading-Skeletons, Fehler-Toasts, leere Zustände, Mobile-Viewport, Tastatur-Navigation, a11y (Labels, Fokus-Handling im Modal).
22. **`npm run check` in allen Workspaces grün** (typecheck + lint + test + build) + `npm audit`-Gates + `knip` + `depcheck` + `format:check`.
23. **Playwright-E2E** (`npm run test:e2e -w web`): neues Szenario „Admin" — **CI-tauglich ohne Postgres**: Verwaltungs-Button öffnet Modal (Tabs Tabellen/Verknüpfungen sichtbar), DB nicht erreichbar → saubere Fehler-/Leerzustände (API 503) statt Crashes, Import-Button vorhanden. Voll-Flow (Import → Preview → Export → Löschen) nur lokal mit Postgres (siehe Schritt 10).
24. **Commits + Branch-Push** → „fertig, bereit für PR" melden mit vorgeschlagener PR-Titel/-Body (PR wird vom Menschen erstellt – Regel 8).

### Phase 5 – Optionale Follow-ups (nur nach Freigabe, 3 Schritte)

25. **Härteres Auth** für die Admin-API (Session/Passwort statt Single-Token), falls gewünscht.
26. **Import-Optionen erweitern**: Zeilen an bestehende Tabelle anhängen, Spalten umbenennen, Zeilen-Limit bei Import.
27. **Zeilen-UI**: CRUD pro Tabelle im Admin-Dialog (einzelne Zeilen einsehen/ändern/löschen).

## 6. Risiken & Mitigation

| #   | Risiko                                                                    | Mitigation                                                                                                                                  |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Admin-API ungeschützt** = jeder kann importieren/löschen                | Admin-Token ab Schritt 9 (env `ADMIN_TOKEN`; fehlt → Admin-Routen 403) – final in §7 entscheiden                                            |
| 2   | `xlsx` (npm) hat Critical-Advisories → `npm audit`-CI rot                 | `exceljs` statt `xlsx` (Schritt 2)                                                                                                          |
| 3   | Neue Deps brechen CI-Gates (`npm audit`, `knip`, `depcheck`, Signatures)  | Gate-Checks lokal vor jedem Commit; Deps nur in `apps/api`                                                                                  |
| 4   | Große Dateien überlasten die API                                          | `multer` 25-MB-Limit, Export-Zeilen-Limit, Stream-Verarbeitung                                                                              |
| 5   | FK-Anlage scheitert bei „dreckigen" Daten                                 | Vorab-Validierung aller Werte + klare Fehlermeldung (Schritt 8)                                                                             |
| 6   | MCP-Chat nur mit echtem LLM nutzbar (MockProvider ohne Tools)             | Erwartung klären; Chat-E2E in CI nur für Tool-Registration                                                                                  |
| 7   | CI-Job `sql-mcp` bricht bei Umbenennung                                   | Bestehende Tools `search_products` / `get_product` unverändert lassen                                                                       |
| 8   | Identifier-Injection via Tabellen-/Spaltennamen                           | Whitelist + quoted Identifiers in `tables.ts` (Schritt 5)                                                                                   |
| 9   | Neue Dependencies vergrößern das Web-Bundle                               | `pg`/`exceljs`/`multer` **nur in `apps/api`** (serverseitig); Web lädt fertige Downloads; `size-limit`-Gate in `apps/web` vor Commit prüfen |
| 10  | **CI hat keinen Postgres-Service** – DB-abhängige Tests brechen in der CI | DB-E2E mit `describe.skipIf(!DATABASE_URL)` (Schritt 10); Playwright-Szenario 23 ohne DB; lokal per Docker-Postgres (Label `ao.session`)    |
| 11  | Vitest holt die DB-E2E in `npm test` rein                                 | `skipIf`-Gate + ggf. separates `test:e2e:api`-Script in `apps/api`; CI-Scripts bleiben grün                                                 |

## 7. Offene Fragen

**Auswirkung der Freigabe (16.10.2026, Status-Log oben):** Die Schritte 8–15 setzen die Empfehlungen um – (1) Admin-Token jetzt, (2) generierte PK = `uuid`, (3) kein ODS, (4) m:n-Brücken in v1, (5) `product`-Tabelle sichtbar/exportierbar/löschbar. Abweichung bitte **vor Phase 1** melden.

1. **Auth**: Admin-Token sofort (empfohlen) oder erst Phase 5?
2. **Generierte PK**: `uuid` (empfohlen) oder `serial`?
3. **ODS** als zusätzliches Import-Format nötig? (zusätzliche Dependency; Default: nein)
4. **m:n-Brückentabellen** in v1? (empfohlen: ja, Schritt 8)
5. Bestehende `product`-Tabelle im Admin anzeigen & dort veränderbar? (empfohlen: anzeigen + exportieren; Löschen erlaubt)

## 8. Freigabe-Optionen

- **`GO`** = Phasen 0–4 komplett, Phase 5 auf Abruf.
- **`GO Phase 0–2`** = nur API + Admin-UI, MCP-Chat (Phase 3) danach.
- Änderungen/Abstriche bitte direkt auf die Nummern (Schritte, Risiken, Fragen) oben beziehen.
