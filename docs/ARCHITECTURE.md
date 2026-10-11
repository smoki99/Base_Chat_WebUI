# Architektur

## Überblick

```
┌────────────────────────────────────────────────────────────┐
│  apps/web (React 19 + Vite)                                │
│  – Holt Daten via fetch von der API                        │
│  – VITE_API_URL (aus .env) oder Vite-Proxy in dev          │
│  – Importiert Typen aus packages/shared                    │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTP / REST
                       ▼
┌────────────────────────────────────────────────────────────┐
│  apps/api (Express)                                        │
│  – src/routes/    → HTTP-Endpunkte (Routen, Validierung)   │
│  – src/services/  → Business-Logik (keine HTTP-Kenntnisse) │
│  – Importiert Typen aus packages/shared                    │
└──────────────────────┬─────────────────────────────────────┘
                       │ import
                       ▼
┌────────────────────────────────────────────────────────────┐
│  packages/shared                                           │
│  – Todo, ApiResponse<T>, ApiError, ApiResult<T>            │
│  – Gemeinsame Typen & DTOs für alle Workspaces             │
│  – Keine eigenen Dependencies (reines TS)                  │
└────────────────────────────────────────────────────────────┘
```

## Gemeinsame Typen (`packages/shared`)

Alle Domänen-Typen und API-DTOs werden **einmalig** in `packages/shared/src/index.ts`
definiert und von beiden Apps importiert:

```ts
// packages/shared/src/index.ts
export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: { message: string };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
```

### Import-Beispiele

```ts
// apps/api/src/services/todoService.ts
import type { Todo } from 'shared';

// apps/web/src/components/TodoList.tsx
import type { ApiResponse, Todo } from 'shared';
```

> **Regel:** Keine lokalen Typ-Duplikate. Neue Typen/DTOs immer in `packages/shared`.

## API-Antwortformat

Jede API-Antwort folgt strikt diesem Schema:

```json
{ "data": ... }
```

oder bei Fehlern:

```json
{ "error": { "message": "..." } }
```

Die Typen `ApiResponse<T>` und `ApiError` aus `packages/shared` modellieren
dieses Format und werden in der Web-App zur Typisierung der Fetch-Antworten verwendet.

## apps/api – Struktur

| Verzeichnis | Zweck |
|-------------|-------|
| `src/routes/` | HTTP-Endpunkte: Routing, Request/Response, Validierung |
| `src/services/` | Business-Logik: rein, ohne HTTP-Abhängigkeiten |
| `src/app.ts` | Express-App-Instanz (export für Tests) |
| `src/index.ts` | Server-Start (`app.listen`) |
| `src/__tests__/` | Integrationstests (Vitest + Supertest) |

## apps/web – Struktur

| Verzeichnis/Datei | Zweck |
|-------------------|-------|
| `src/components/` | React-Komponenten |
| `src/__tests__/` | Komponenten-Tests (Vitest + React Testing Library) |
| `src/test/setup.ts` | Test-Setup (`@testing-library/jest-dom`) |
| `src/main.tsx` | React Entry Point |
| `vite.config.ts` | Vite-Plugin, Dev-Proxy, Vitest-Config |
| `index.html` | Vite HTML-Entry |

### Dev-Proxy

In der Entwicklung proxys Vite `/api/*` auf `http://localhost:3001`,
somit ist `VITE_API_URL` in dev nicht erforderlich.
In Produktion wird `VITE_API_URL` aus der Environment gesetzt.

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
   - Holt Daten über `fetch` von der API (URL: `VITE_API_URL` oder Proxy)
   - Keine direkten Datenbankzugriffe

5. **Konfiguration**
   - Secrets/Config ausschließlich aus `.env`
   - Vorlage: `.env.example`

## Monorepo-Konventionen

- npm Workspaces (keine Yarn/pnpm)
- TypeScript strict + `noUncheckedIndexedAccess`
- Gemeinsamer `tsconfig.base.json`
- ESLint flat config (root) + typescript-eslint
- Prettier für Formatting (Konflikte via `eslint-config-prettier` eliminiert)
- `shared` wird als `"shared": "*"` in die Dependencies der Apps referenziert
