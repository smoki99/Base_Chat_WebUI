# Progress

## Ziel

Vollwertige Chat-Webseite (kein Todo-Stack mehr).

Nutzer schreibt eine Nachricht → die API antwortet. Provider-agnostisch:
hinter dem `ChatProvider`-Interface stehen zwei Implementierungen, wählbar
über die Env-Variable `CHAT_PROVIDER`:

- `mock` (Standard): keyword-basierte Antworten aus `chatbot.rules.json` +
  Fallback-Pool, deterministisch testbar (injizierbarer RNG).
- `openai`: OpenAI-kompatible Endpunkte (LM Studio, Ollama, …) für echte
  LLM-Antworten.

## Logik

- `packages/shared` – `ChatMessage` (Single Source of Truth für die Wire-Typen).
- `apps/api/src/types/chat.ts` – `ChatProvider`-Interface, `HealthStatus`.
- `apps/api/src/config/chatbotConfig.ts` – lädt + validiert `chatbot.rules.json`
  (Keyword-Regeln + Fallback-Pool), Default-Fallback bei Fehlschlag.
- `apps/api/src/services/chatService.ts` – wählt Provider, `respond()`,
  Lazy-Cache + `resetProvider()` für Tests.
- `apps/api/src/services/providers/mockProvider.ts` – keyword-Match +
  Random-Fallback, `healthCheck`.
- `apps/api/src/services/providers/openaiProvider.ts` – OpenAI-kompatible LLM-Antwort.
- `apps/api/src/routes/chat.ts` – `POST /api/chat`.
- `apps/api/src/routes/health.ts` – Health-Status (inkl. Provider-`healthCheck`).
- `apps/web/src/hooks/useChat.ts` – State + `send()`, spricht `POST /api/chat`,
  optimistisches Update (sending / sent / error).
- `apps/web/src/components/Chat.tsx` – Nachrichten-Log, Empty-/Error-State,
  "Bot schreibt …"-Indikator, Composer.

## Status

- ✅ Web-UI (`Chat.tsx` + `useChat`) mit Empty-, Loading- und Error-State.
- ✅ API `POST /api/chat` mit provider-agnostischer Schicht (mock + openai).
- ✅ Shared-Typen (`ChatMessage`) in `packages/shared`.
- ✅ Tests: API (chat, chatbot-config, openai-provider, cors, security),
  Web (`Chat.test.tsx`), E2E (`e2e/chat.spec.ts`).
- ✅ Story-0026 (Chat-UI + Mock-API + Tests) und Story-0027 (E2E-Timeouts)
  abgeschlossen.
- ✅ CI grün: typecheck · lint · test · build · e2e.

## Offene Punkte / Nächste Schritte

- [x] `openai`-Provider gegen lokale LLM-Endpunkte (LM Studio / Ollama) mit
      echtem `.env` durchtesten. → `npm run dev:lmstudio` (Story-0028)
- [x] MCP (Model Context Protocol) Integration – Tool-Calling ohne externe SDKs.
      Filesystem-Tools funktionieren live. (Story-0030)
- [ ] Conversations-Verlauf / Session-Persistenz (optional).
- [ ] `README.md` und `docs/DECISIONS.md` konsistent auf den Chat-Status prüfen.
- [ ] Postgres-MCP-Server für SQL-Tool-Calling.
- [ ] Markdown-Knowledge-Base mit keyword-basiertem Retrieval.
