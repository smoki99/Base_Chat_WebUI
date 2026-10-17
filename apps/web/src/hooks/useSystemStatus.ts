/**
 * useSystemStatus (Story-0037) – polls GET /api/status and exposes the
 * latest result plus a manual `refresh()` for the "Testen" buttons.
 *
 * Polling is gated on document visibility so a hidden tab does not hammer
 * the API. Failures keep the last known status (the dot stays red/green)
 * and surface the transport error in `error`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SystemStatus } from 'shared';
import { fetchSystemStatus } from '../lib/api';

const POLL_INTERVAL_MS = 30_000;

export interface UseSystemStatusResult {
  status: SystemStatus | null;
  /** Transport-level error from the latest poll (null when the last poll succeeded). */
  error: string | null;
  /** True while a poll is in flight (initial load or manual refresh). */
  loading: boolean;
  /** Force a fresh poll (used by the Settings "Testen" buttons). */
  refresh: () => Promise<void>;
}

export function useSystemStatus(): UseSystemStatusResult {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef<Promise<void> | null>(null);

  const poll = useCallback(async () => {
    // Avoid overlapping polls (e.g. visibility change + manual refresh).
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      try {
        const next = await fetchSystemStatus();
        setStatus(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await poll();
  }, [poll]);

  useEffect(() => {
    void poll();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  return { status, error, loading, refresh };
}
