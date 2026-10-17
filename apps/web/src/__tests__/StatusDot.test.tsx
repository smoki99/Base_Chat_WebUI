import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StatusDot } from '../components/StatusDot';

const base = {
  uptime: 12,
  api: { host: '127.0.0.1', port: 4001, ip: '192.168.1.10' }, // eslint-disable-line sonarjs/no-hardcoded-ip
  database: { ok: true, configured: true, endpoint: 'localhost:5432' },
  voice: { ok: true, configured: true, tts: true, stt: true, endpoint: 'http://127.0.0.1:8765' },
};

function mockStatus(llm: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/status')) {
      return { ok: true, json: async () => ({ data: { ...base, llm } }) } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('StatusDot', () => {
  it('is green (ok) when the openai LLM is reachable', async () => {
    mockStatus({
      ok: true,
      configured: true,
      provider: 'openai',
      endpoint: 'http://localhost:1234/v1',
      latencyMs: 42,
    });
    render(<StatusDot />);
    const dot = await screen.findByRole('status');
    await waitFor(() => expect(dot).toHaveClass('status-dot--ok'));
    expect(dot).toHaveAttribute('title', 'LLM erreichbar (42 ms)');
  });

  it('is blue when the mock provider is active', async () => {
    mockStatus({
      ok: true,
      configured: true,
      provider: 'mock',
      detail: 'Mock-Provider aktiv (kein externer LLM-Dienst konfiguriert)',
    });
    render(<StatusDot />);
    const dot = await screen.findByRole('status');
    await waitFor(() => expect(dot).toHaveClass('status-dot--mock'));
    expect(dot).toHaveAttribute('title', expect.stringContaining('Mock-Provider'));
  });

  it('is red with the error detail when the LLM is unreachable', async () => {
    mockStatus({
      ok: false,
      configured: true,
      provider: 'openai',
      endpoint: 'http://localhost:1234/v1',
      detail: 'LLM nicht erreichbar: ECONNREFUSED',
    });
    render(<StatusDot />);
    const dot = await screen.findByRole('status');
    await waitFor(() => expect(dot).toHaveClass('status-dot--error'));
    expect(dot).toHaveAttribute('title', expect.stringContaining('ECONNREFUSED'));
  });

  it('is red when the API itself is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('API nicht erreichbar');
    });
    render(<StatusDot />);
    const dot = await screen.findByRole('status');
    await waitFor(() => expect(dot).toHaveClass('status-dot--error'));
    expect(dot).toHaveAttribute('title', expect.stringContaining('API nicht erreichbar'));
  });
});
