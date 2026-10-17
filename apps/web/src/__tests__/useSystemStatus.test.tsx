import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSystemStatus } from '../hooks/useSystemStatus';

const sampleStatus = {
  uptime: 12,
  api: { host: '127.0.0.1', port: 4001, ip: '192.168.1.10' }, // eslint-disable-line sonarjs/no-hardcoded-ip
  llm: {
    ok: true,
    configured: true,
    provider: 'openai' as const,
    endpoint: 'http://localhost:1234/v1',
    model: 'm',
    latencyMs: 20,
  },
  database: { ok: true, configured: true, endpoint: 'localhost:5432' },
  voice: {
    ok: false,
    configured: true,
    tts: false,
    stt: false,
    endpoint: 'http://127.0.0.1:8765',
    detail: 'timeout',
  },
};

function mockFetch(payload: unknown) {
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSystemStatus', () => {
  it('loads the status on mount', async () => {
    const fetchMock = mockFetch({ data: sampleStatus });
    const { result } = renderHook(() => useSystemStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toEqual(sampleStatus);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces transport errors but keeps previous status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: sampleStatus }),
        }) as unknown as Promise<Response>
    );
    const { result } = renderHook(() => useSystemStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toEqual(sampleStatus);

    fetchMock.mockImplementation(async () => {
      throw new Error('API nicht erreichbar');
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('API nicht erreichbar');
    expect(result.current.status).toEqual(sampleStatus); // last good value kept
  });

  it('polls again after the 30 s interval while the tab is visible', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = mockFetch({ data: sampleStatus });
      renderHook(() => useSystemStatus());
      // initial poll (microtasks)
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
