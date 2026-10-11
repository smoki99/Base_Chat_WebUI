# Architektur

## Überblick

```
┌────────────────────────────────────────────────────┐
│  apps/web (React 19 + Vite)                        │
│  – Holt Daten via fetch von der API                │
│  – VITE_API_URL (aus .env)                         │
└──────────────────────┬─────────────────────────────┘
                       │ HTTP / REST
                       ▼
┌────────────────────────────────────────────────────┐
│  apps/api (Express)                                │
│  – src/routes/   → HTTP-Endpunkte                  │
│  – src/services/ → Business-Logik                  │
└──────────────────────┬─────────────────────────────┘
                       │ import
                       ▼
┌────────────────────────────────────────────────────┐
│  packages/shared                                   │
│  – Gemeinsame Typen, DTOs, Utility-Funktionen      │
│  – Keine eigenen Dependencies (reines TS)          │
└────────────────────────────────────────────────────┘
```

## Regeln

1. **Gemeinsame Typen** leben ausschließlich in `packages/shared`.
   Duplizierung von Typen/DTOs ist verboten.

2. **API-Antwortformat** ist strikt:
   ```json
   { "data": ... }
   { "error": { "message": "..." } }
   ```

3. **apps/api**
   - `src/routes/` – HTTP-Endpunkte (Routen-Definition, Validierung)
   - `src/services/` – Business-Logik (keine HTTP-Kenntnisse)

4. **apps/web**
   - Hält Daten über `fetch` von der API (URL: `VITE_API_URL`)
   - Keine direkte Datenbankzugriffe

5. **Konfiguration**
   - Secrets/Config ausschließlich aus `.env`
   - Vorlage: `.env.example`

## Monorepo-Konventionen

- npm Workspaces (keine Yarn/pnpm)
- TypeScript strict + `noUncheckedIndexedAccess`
- Gemeinsamer `tsconfig.base.json`
- ESLint flat config (root) + typescript-eslint
- Prettier für Formatting (Konflikte via `eslint-config-prettier` eliminiert)
