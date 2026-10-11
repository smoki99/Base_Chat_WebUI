# myapp

TypeScript (strict) Monorepo mit npm Workspaces.

## Stack

| Layer | Tech |
|-------|------|
| `apps/web` | React 19 + Vite (nur UI) |
| `apps/api` | Express (REST) |
| `packages/shared` | Gemeinsame Typen & DTOs |

## Struktur

```
myapp/
├── apps/
│   ├── api/          # Express REST API
│   └── web/          # React + Vite Frontend
├── packages/
│   └── shared/       # Gemeinsame Typen/DTOs
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

## Befehle

| Command | Beschreibung |
|---------|--------------|
| `npm run dev` | Web + API parallel starten |
| `npm run build` | Alle Workspaces bauen |
| `npm run lint` | ESLint auf allen Workspaces |
| `npm run test` | Tests in allen Workspaces |
| `npm run typecheck` | TypeScript Typecheck (strict) |
| `npm run format` | Prettier formatiert den Code |

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Konventionen

- API-Antworten: `{ "data": ... }` oder `{ "error": { "message": ... } }`
- Gemeinsame Typen immer in `packages/shared`
- Config aus `.env` (Vorlage: `.env.example`)
- Conventional Commits (deutsche Subjects)
