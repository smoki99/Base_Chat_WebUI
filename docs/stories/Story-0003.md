# Story-0003: Optimistisches Toggle vor Doppelklick-Race schützen

**Status:** ✅ erledigt
**Priorität:** Mittel
**Zugehöriger Audit-Befund:** #4
**Abgeschlossen am:** 11.10.2026

## Kontext

`apps/web/src/components/TodoList.tsx` toggelt optimistisch: lokaler Zustand wird
sofort umgekehrt, bei Fehler per `catch` zurückgerollt. Zwei schnelle Klicks auf
denselben Todo erzeugen zwei in-flight PATCH-Requests. Scheitert der erste,
überschreibt sein Rollback den optimistischen Zustand des zweiten Klicks →
UI und Server-Status divergieren.

## Akzeptanzkriterien

1. **Given** ein Todo **When** der User es toggelt, während der zugehörige PATCH noch in-flight ist **Then** ein zweites Toggle desselben Todos wird ignoriert (kein zweiter PATCH).
2. **Given** ein in-flight Toggle, das fehlschlägt **Then** der Zustand wird exakt auf den Vor-Zustand zurückgerollt; ein währenddessen ignoriertes zweites Toggle führt nicht zu einer abweichenden UI.
3. **Given** der in-flight PATCH ist abgeschlossen (Erfolg oder Fehler) **Then** das Toggle desselben Todos ist wieder erlaubt.
4. Verschiedene Todos können parallel getogglet werden (Lock ist pro Todo-ID, nicht global).
5. UI bleibt durchgehend bedienbar; keine zusätzliche Spinner-Logik, die den Flow blockiert.

## Tasks

- [x] `TodoList.tsx`: Inflight-Tracking pro Todo-ID einführen (z. B. `useRef<Set<number>>`), im `handleToggle` prüfen, bei Fehler/Erfolg im `finally` entfernen
- [x] Zweites Toggle während Inflight: frühes `return` (kein PATCH, kein Zustandswechsel)
- [x] Web-Test ergänzen (Mock-Strategie der bestehenden Tests in `apps/web/src` beibehalten):
      - simuliere ungelösten PATCH → zweiter Klick wird ignoriert
      - löse ersten PATCH mit Fehler → Zustand = Ausgangszustand
- [x] Bestehende Toggle-/Rollback-Tests unverändert lassen

## Definition of Done

- [x] `npm test -w web` grün
- [x] `npm run typecheck` und `npm run lint` grün
- [x] Manueller Check: Doppelklick im Dev-Server erzeugt exakt 1 PATCH (Network-Tab)
