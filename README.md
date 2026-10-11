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
│       │   ├── __tests__/    # RTL-Tests
│       │   └── main.tsx      # React Entry
│       ├── index.html        # Vite Entry
│       ├── vite.config.ts    # Proxy + Vitest-Config
│       └── package.json
├── packages/
│   └── shared/               # Gemeinsame Typen/DTOs
│       ├── src/index.ts      # Todo, ApiResponse, ApiResult
│       └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   └── DECISIONS.md
├── .clinerules/
├── .env.example
├── eslint.config.js
├── package.json
├── tsconfig.base.json
└── .prettierrc
```

## Setup

### Voraussetzungen

- **Node.js ≥ 20** (LTS)
- **npm ≥ 10**

### Installation & Start

```bash
# 1. Dependencies installieren
npm install

# 2. Environment-Variabeln kopieren
cp .env.example .env

# 3. Dev-Server starten (web + api parallel)
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
| `npm run test` | Tests in allen Workspaces (Vitest) |
| `npm run typecheck` | TypeScript Typecheck (strict) |
| `npm run format` | Prettier formatiert den Code |

## Konventionen

- **API-Antworten:** `{ "data": ... }` oder `{ "error": { "message": ... } }`
- **Gemeinsame Typen** immer in `packages/shared` definieren – nie duplizieren
- **Config** ausschließlich aus `.env` (Vorlage: `.env.example`)
- **Git:** Conventional Commits mit deutschen Subjects
