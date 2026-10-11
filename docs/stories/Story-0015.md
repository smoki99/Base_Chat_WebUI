# Story-0015: AGENTS.md (agent-agnostisch) + Guardrails

**Status:** ⬜ offen
**Priority:** High
**Bereich:** `AGENTS.md`, `.clinerules/main.md`, `README.md`
**Phase:** 5 – Meta

## Kontext

`.clinerules/main.md` ist Cline-spezifisch und enthält alle Regeln.
Best Practice: **eine** agent-agnostische `AGENTS.md` als Single Source of
Truth, die alle KI-Agenten (Cline, Cursor, Claude, …) lesen.
`.clinerules/main.md` wird zum kurzen Verweis + Cline-spezifische Ergänzungen.

> Enthält die Guardrails aus der gelöschten Story-0019.

## Akzeptanzkriterien

- [ ] `AGENTS.md` im Repo-Root: vollständige Regeln (Stack, Befehle,
      Architektur, Guardrails, Conventional Commits, Quality Gate)
- [ ] `.clinerules/main.md`: kurzer Verweis auf `AGENTS.md` +
      Cline-spezifische Ergänzungen (max. ~20 Zeilen)
- [ ] `README.md`: Sektion „AI Agents" mit Link auf `AGENTS.md`
- [ ] Keine Regel-Duplikation zwischen `AGENTS.md` und `.clinerules`

## Guardrails (in AGENTS.md aufnehmen)

- Keine neuen Dependencies ohne Rückfrage
- Keine Secrets im Code (Config aus `.env`)
- Vor Änderungen: relevante Dateien lesen, nichts annehmen
- Vor „fertig" melden: alle Gates grün (`npm run check`)
- Bei Unsicherheit: Frage stellen statt raten

## Tasks

- [ ] `AGENTS.md` anlegen (Inhalte aus `.clinerules/main.md` + Guardrails)
- [ ] `.clinerules/main.md` auf Verweis + Cline-spezifik reduzieren
- [ ] `README.md`: Sektion „AI Agents" ergänzen
- [ ] `docs/RULES.md` verweist auf `AGENTS.md` als SSOT

## Definition of Done

- [ ] `AGENTS.md` existiert und ist vollständig
- [ ] `.clinerules/main.md` ist schlank (< 20 Zeilen)
- [ ] `README.md` verweist auf `AGENTS.md`
- [ ] Keine Regel-Duplikation
