/**
 * StatusDot (Story-0037) – LLM-reachability indicator for the sidebar.
 *
 * Colors: green = LLM reachable · blue = mock provider active (no remote
 * service) · red = LLM unreachable or API down · gray = still loading.
 * The tooltip (`title`) carries the server-side detail, e.g.
 * "LLM nicht erreichbar: ECONNREFUSED".
 */
import { useSystemStatus } from '../hooks/useSystemStatus';

export type StatusDotState = 'ok' | 'mock' | 'error' | 'loading';

function deriveState(status: ReturnType<typeof useSystemStatus>): StatusDotState {
  // A transport error (API unreachable) wins over a stale payload, so the
  // indicator turns red instead of freezing on the last known status.
  if (status.error) return 'error';
  if (!status.status || status.loading) return 'loading';
  if (status.status.llm.provider === 'mock') return 'mock';
  return status.status.llm.ok ? 'ok' : 'error';
}

function tooltip(state: StatusDotState, status: ReturnType<typeof useSystemStatus>): string {
  const llm = status.status?.llm;
  if (state === 'loading') return 'Status wird geprüft…';
  if (state === 'mock') return llm?.detail ?? 'Mock-Provider aktiv';
  if (status.error) return status.error;
  if (llm && llm.ok) {
    return llm.latencyMs != null ? `LLM erreichbar (${llm.latencyMs} ms)` : 'LLM erreichbar';
  }
  return llm?.detail ?? 'LLM nicht erreichbar';
}

export function StatusDot() {
  const hook = useSystemStatus();
  const state = deriveState(hook);
  return (
    <span
      className={`status-dot status-dot--${state}`}
      role="status"
      aria-label={tooltip(state, hook)}
      title={tooltip(state, hook)}
    />
  );
}
