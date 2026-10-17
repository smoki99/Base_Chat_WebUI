import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagnosticsTab } from '../components/DiagnosticsTab';

const sampleStatus = {
  uptime: 99,
  api: { host: '0.0.0.0', port: 4001, ip: '172.17.0.3' }, // eslint-disable-line sonarjs/no-hardcoded-ip
  llm: {
    ok: false,
    configured: true,
    provider: 'openai' as const,
    endpoint: 'http://localhost:1234/v1',
    model: 'local-model',
    detail: 'LLM nicht erreichbar: ECONNREFUSED',
  },
  database: { ok: true, configured: true, endpoint: '172.17.0.2:5432', latencyMs: 8 },
  voice: {
    ok: false,
    configured: true,
    tts: false,
    stt: false,
    endpoint: 'http://127.0.0.1:8765',
    detail: 'timeout (5 s)',
  },
};

function mockStatus(payload: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => payload,
      }) as unknown as Promise<Response>;
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({}),
    }) as unknown as Promise<Response>;
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('DiagnosticsTab', () => {
  it('shows the own instance (IP:port) and the three service rows with targets', async () => {
    mockStatus({ data: sampleStatus });
    render(<DiagnosticsTab />);

    expect(await screen.findByText(/Eigene Instanz/)).toBeInTheDocument();
    expect(await screen.findByText(/172\.17\.0\.3:4001/)).toBeInTheDocument();

    // Targets (host:port) are visible per service.
    expect(await screen.findByText(/localhost:1234/)).toBeInTheDocument();
    expect(screen.getByText(/172\.17\.0\.2:5432/)).toBeInTheDocument();
    expect(screen.getByText(/127\.0\.0\.1:8765/)).toBeInTheDocument();

    // Status texts: healthy DB with latency, failing LLM/Voice with detail.
    expect(screen.getByText('Erreichbar · 8 ms')).toBeInTheDocument();
    expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument();
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
  });

  it('"Testen" on the LLM row refetches the status and shows the fresh result', async () => {
    const user = userEvent.setup();
    const fetchMock = mockStatus({ data: sampleStatus });
    render(<DiagnosticsTab />);
    await screen.findByText('Erreichbar · 8 ms');

    // The LLM row starts failing…
    expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument();

    // …then the next "Testen" round-trip succeeds.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/status')) {
        const fixed = {
          ...sampleStatus,
          llm: {
            ok: true,
            configured: true,
            provider: 'openai',
            endpoint: 'http://localhost:1234/v1',
            model: 'local-model',
            latencyMs: 31,
          },
        };
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: fixed }),
        }) as unknown as Promise<Response>;
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      }) as unknown as Promise<Response>;
    });

    const llmRow = screen.getByText(/ECONNREFUSED/).closest('tr') as HTMLTableRowElement;
    await user.click(llmRow.querySelector('button') as HTMLButtonElement);
    expect(await screen.findByText('Erreichbar · 31 ms')).toBeInTheDocument();
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });

  it('shows a friendly alert when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('API nicht erreichbar');
    });
    render(<DiagnosticsTab />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/API nicht erreichbar/);
  });
});
