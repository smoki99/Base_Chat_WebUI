/**
 * DiagnosticsTab (Story-0037) – Settings tab "Verbindung".
 *
 * Shows the API instance's own address (container debugging: "where am I?")
 * and one row per service (LLM, database, voice) with target host:port,
 * status, latency and a per-row "Testen" button. All data comes from the
 * public GET /api/status endpoint – no tokens, no credentials.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ServiceStatus } from 'shared';
import { fetchSystemStatus } from '../lib/api';
import type { SystemStatus } from 'shared';

interface RowDef {
  key: 'llm' | 'database' | 'voice';
  label: string;
  endpoint: (status: SystemStatus) => string | undefined;
}

const ROWS: RowDef[] = [
  { key: 'llm', label: 'LLM', endpoint: (s) => s.llm.endpoint },
  { key: 'database', label: 'Datenbank (SQL)', endpoint: (s) => s.database.endpoint },
  { key: 'voice', label: 'Voice (voz)', endpoint: (s) => s.voice.endpoint },
];

type RowState = 'ok' | 'error' | 'off';

function rowState(key: RowDef['key'], status: SystemStatus): RowState {
  const svc = status[key];
  if (key === 'llm' && status.llm.provider === 'mock') return 'off';
  if (svc.ok) return 'ok';
  return svc.configured ? 'error' : 'off';
}

function rowText(key: RowDef['key'], svc: ServiceStatus, status: SystemStatus): string {
  if (key === 'llm' && status.llm.provider === 'mock') return 'Mock-Provider aktiv';
  if (!svc.configured) return 'Nicht konfiguriert';
  if (svc.ok) {
    return svc.latencyMs != null ? `Erreichbar · ${svc.latencyMs} ms` : 'Erreichbar';
  }
  return svc.detail ? svc.detail : 'Nicht erreichbar';
}

export function DiagnosticsTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState<RowDef['key'] | null>(null);

  const load = useCallback(async (row: RowDef['key'] | null) => {
    if (row) setTesting(row);
    else setTesting(null);
    setError('');
    try {
      const next = await fetchSystemStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(null);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <div className="diagnostics">
      <div className="diagnostics-instance">
        <h3 className="diagnostics-heading">Eigene Instanz</h3>
        {status ? (
          <p className="form-text mb-0">
            <code>
              http://{status.api.ip ?? status.api.host}:{status.api.port}
            </code>{' '}
            (Bind:{' '}
            <code>
              {status.api.host}:{status.api.port}
            </code>
            , API-Uptime {status.uptime} s)
          </p>
        ) : (
          <p className="form-text mb-0">{error || 'Lädt…'}</p>
        )}
      </div>

      <table className="diagnostics-table">
        <thead>
          <tr>
            <th scope="col">Dienst</th>
            <th scope="col">Ziel (Host:Port)</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="visually-hidden">Aktion</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const svc = status ? status[row.key] : null;
            const state = svc && status ? rowState(row.key, status) : 'off';
            const endpointText = svc && status ? (row.endpoint(status) ?? '–') : '–';
            const idleText = testing ? 'Prüfe…' : 'Status prüfen…';
            const statusText = svc && status ? rowText(row.key, svc, status) : error || idleText;
            return (
              <tr key={row.key}>
                <th scope="row">
                  <span className={`status-dot status-dot--${state}`} aria-hidden="true" />
                  {row.label}
                </th>
                <td>{endpointText}</td>
                <td>{statusText}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={testing !== null}
                    aria-busy={testing === row.key}
                    onClick={() => void load(row.key)}
                  >
                    {testing === row.key ? 'Prüfe…' : 'Testen'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && (
        <p className="form-text diagnostics-error" role="alert">
          Status nicht abrufbar: {error}
        </p>
      )}
      <p className="form-text">
        Tipp für Container: Die Ziel-Adressen müssen aus dem API-Container erreichbar sein (z. B.
        Service-Name des Docker-Netzes statt <code>localhost</code>).
      </p>
    </div>
  );
}
