# myapp

TypeScript (strict) Monorepo mit npm Workspaces.

## Stack

| Layer | Tech |
|-------|------|
| `apps/web` | React 19 + Vite (nur UI) |
| `apps/api` | Express (REST) |
| `packages/shared` | Gemeinsame Typen & DTOs (reines TS, keine Deps) |

## Struktur

```
myapp/
├── apps/
│   ├── api/                  # Express REST API
│   │   ├── src/
│   │   │   ├── app.ts        # Express App (export für Tests)
│   │   │   ├── index.ts      # Server-Start
│   │   │   ├── routes/       # HTTP-Endpunkte
│   │   │   ├── services/     # Business-Logik
│   │   │   └── __tests__/    # Supertest-Tests
│   │   └── package.json
│   └── web/                  # React + Vite Frontend
│       ├── src/
│       │   ├── components/   # React-Komponenten
│       │   ├── __tests__/    # RTL-Tests (Vitest)
│       │   └── main.tsx      # React Entry
│       ├── e2e/              # Playwright-E2E (headless Chromium)
│       ├── index.html        # Vite Entry
│       ├── playwright.config.ts  # E2E: webServer (API + Web)
│       ├── vite.config.ts    # Proxy + Vitest-Config (e2e/ excluded)
│       └── package.json
├── packages/
│   └── shared/               # Gemeinsame Typen/DTOs
│       ├── src/index.ts      # Todo, ApiResponse, ApiResult
│       └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   └── PROGRESS.md
├── .github/
│   └── workflows/ci.yml      # GitHub Actions (Node 24)
├── .clinerules/
├── .env.example
├── .nvmrc                    # Node 24
├── .editorconfig
├── .prettierrc
├── eslint.config.js
├── package.json
├── tsconfig.base.json
└── LICENSE
```

## Setup

### Voraussetzungen

- **Node.js ≥ 24** (LTS) – siehe `.nvmrc` + `engines` in `package.json`
- **npm ≥ 10** (Node 24 liefert npm 11.x)

### Installation & Start

```bash
# 1. Dependencies installieren
npm install

# 2. Environment-Variabeln kopieren
cp .env.example .env

# 3. (nur für E2E) Playwright-Browser installieren
npx playwright install chromium

# 4. Dev-Server starten (web + api parallel)
npm run dev
```

Danach:
- **Web:** http://localhost:5173
- **API:** http://localhost:3001
- **Health-Check:** http://localhost:3001/health

### Environment-Variablen

| Variable | Beschreibung | Default |
|----------|-------------|---------|
| `PORT` | API-Port | `3001` |
| `CORS_ORIGIN` | Erlaubte CORS-Origin(s) für die API (prod), kommagetrennt | leer (alle) |
| `VITE_API_URL` | API-Basis-URL für das Web (prod) | `http://localhost:3001` |

> In der Entwicklung übernimmt der **Vite-Proxy** (`/api` → `localhost:3001`),
> `VITE_API_URL` wird dann nicht benötigt.
>
> Für separate Origins in Produktion: `CORS_ORIGIN` auf der API setzen – oder
> (empfohlen) Web + API hinter einem Reverse Proxy (same-origin) ausliefern.
> Details: `docs/ARCHITECTURE.md` → „CORS & Prod-Deployment".

## Befehle

| Command | Beschreibung |
|---------|--------------|
| `npm run dev` | Web + API parallel starten (concurrently) |
| `npm run build` | Alle Workspaces bauen |
| `npm run lint` | ESLint auf allen Workspaces |
| `npm run test` | Unit-Tests in allen Workspaces (Vitest) |
| `npm run test:e2e` | Playwright-E2E (headless Chromium); startet API + Web automatisch |
| `npm run typecheck` | TypeScript Typecheck (strict) |
| `npm run format` | Prettier formatiert den Code |

## Tests

- **Unit (Vitest):** `npm test`
  - `apps/api` via Supertest · `apps/web` via React Testing Library + jsdom.
  - `e2e/**` wird aus dem Vitest-Run explizit ausgeschlossen.
- **E2E (Playwright, headless Chromium):** `npm run test:e2e`
  - Startet **API + Web automatisch** über `webServer` mit Readiness
    (`/health` bzw. Port 5173) – kein manuelles `npm run dev`.
  - Vor dem ersten Lauf einmalig: `npx playwright install chromium`.
  - Deckt ab: `GET /` (200, `text/html`), `GET /index.html` (200),
    React-Mount, seeded-Todos, keine Page-/Console-Errors.

## CI (GitHub Actions)

`.github/workflows/ci.yml` — Trigger: `push` (`master`, `feature/*`),
`pull_request` (`master`), `workflow_dispatch`.

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test` (Unit)
5. `npm run build`
6. `npx playwright install --with-deps chromium`
7. `npm run test:e2e -w web`

Die Actions laufen nativ auf **Node 24** (`actions/checkout@v7`,
`actions/setup-node@v7`).

## Konventionen

- **API-Antworten:** `{ "data": ... }` oder `{ "error": { "message": ... } }`
- **Gemeinsame Typen** immer in `packages/shared` definieren – nie duplizieren
- **Config** ausschließlich aus `.env` (Vorlage: `.env.example`)
- **Git:** Conventional Commits mit deutschen Subjects
