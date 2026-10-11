# Story-0011: AGENTS.md (agent-agnostisch)

**Status:** ⬜ offen
**Priority:** High
**Bereich:** Root
**Review-Befund:** `.clinerules` ist Cline-spezifisch; eine agent-agnostische
`AGENTS.md` (OpenAI Codex, Gemini CLI, Cline, Aider, Copilot …) fehlt.
Das Repo ist explizit als Cline/Qwen-Baseline für KI-Agenten-Workflows
gedacht und sollte mit allen Agenten funktionieren.

## Kontext

Unterschiedliche Agenten lesen unterschiedliche Regel-Dateien: Claude Code
liest `CLAUDE.md`, Cline liest `.clinerules`, Codex und andere lesen
`AGENTS.md`. Eine agent-agnostische `AGENTS.md`, auf die alle anderen
verweisen, reduziert Duplikation und hält die Regeln konsistent.

## Akzeptanzkriterien

- [ ] `AGENTS.md` im Repo-Root: Projekt-Übersicht, Struktur, Befehle
      (check/test/e2e), Konventionen, Guardrails (siehe Story-0019)
- [ ] `CLAUDE.md`: kurze Übersicht + Verweis "Siehe `AGENTS.md` für die
      vollen Regeln"
- [ ] `.clinerules`: kurze Übersicht + Verweis auf `AGENTS.md`
- [ ] `README.md`: Sektion "AI Agents", die auf `AGENTS.md` verweist
- [ ] Keine Widersprüche zwischen den Regel-Dateien (manuelle Prüfung)

## Tasks

- [ ] `AGENTS.md` schreiben (auf Basis der bestehenden Regeln aus
      `CLAUDE.md`/`.clinerules`)
- [ ] `CLAUDE.md` verschlanken (Übersicht + Verweis)
- [ ] `.clinerules` verschlanken (Übersicht + Verweis)
- [ ] `README.md`: Link ergänzen

## Definition of Done

Alle Agenten (Cline, Claude Code, Codex) finden konsistente Regeln;
`AGENTS.md` ist Single Source of Truth.
