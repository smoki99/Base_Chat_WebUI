import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSystemStatus,
  probeLlm,
  probeDatabase,
  probeVoiceStatus,
} from '../services/statusService';

vi.mock('../services/pgPool', () => ({ getPool: vi.fn() }));
vi.mock('../services/chatService', () => ({ getProviderName: vi.fn() }));

vi.mock('../services/voiceClient', () => ({
  VOICE_SERVICE_URL: 'http://127.0.0.1:8765',
  probeVoice: vi.fn(),
}));

import { getPool } from '../services/pgPool';
import { getProviderName } from '../services/chatService';
import { probeVoice } from '../services/voiceClient';

const mockGetPool = vi.mocked(getPool);
const mockProviderName = vi.mocked(getProviderName);
const mockProbeVoice = vi.mocked(probeVoice);

const saved = {
  CHAT_PROVIDER: process.env.CHAT_PROVIDER,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  DATABASE_URL: process.env.DATABASE_URL,
  HOST: process.env.HOST,
  PORT: process.env.PORT,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CHAT_PROVIDER = 'mock';
  process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
  process.env.OPENAI_MODEL = 'local-model';
  delete process.env.DATABASE_URL;
  process.env.HOST = '127.0.0.1';
  process.env.PORT = '4001';
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const okResponse = () =>
  ({ ok: true, status: 200, json: async () => ({ data: [] }) }) as unknown as Response;

describe('probeLlm', () => {
  it('mock provider is healthy without probing a remote service', async () => {
    vi.stubGlobal('fetch', vi.fn());
    try {
      const status = await probeLlm();
      expect(status).toMatchObject({ ok: true, configured: true, provider: 'mock' });
      expect(status.detail).toMatch(/Mock-Provider/);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('openai provider: reachable /models endpoint is healthy', async () => {
    mockProviderName.mockReturnValue('openai');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    try {
      const status = await probeLlm();
      expect(status).toMatchObject({
        ok: true,
        provider: 'openai',
        endpoint: 'http://localhost:1234/v1',
        model: 'local-model',
      });
      expect(status.latencyMs).toBeTypeOf('number');
      expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
        'http://localhost:1234/v1/models'
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('openai provider: HTTP error is reported with an auth hint for 401', async () => {
    mockProviderName.mockReturnValue('openai');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    try {
      const status = await probeLlm();
      expect(status.ok).toBe(false);
      expect(status.detail).toContain('401');
      expect(status.detail).toContain('Auth');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('openai provider: connection refused is reported with the cause code', async () => {
    mockProviderName.mockReturnValue('openai');
    const err = Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
    try {
      const status = await probeLlm();
      expect(status.ok).toBe(false);
      expect(status.detail).toContain('ECONNREFUSED');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe('probeDatabase', () => {
    it('reports "not configured" without DATABASE_URL', async () => {
      const status = await probeDatabase();
      expect(status).toMatchObject({ ok: false, configured: false });
      expect(status.detail).toMatch(/DATABASE_URL/);
    });

    it('SELECT 1 success → healthy with endpoint host:port (no credentials)', async () => {
      process.env.DATABASE_URL = 'postgres://user:secret@db.internal:5432/appdb';
      const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockGetPool.mockReturnValue({ query } as never);
      const status = await probeDatabase();
      expect(status.ok).toBe(true);
      expect(status.endpoint).toBe('db.internal:5432');
      expect(status.detail ?? '').not.toContain('secret');
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('query failure → unhealthy with error detail', async () => {
      process.env.DATABASE_URL = 'postgres://user:secret@db.internal:5432/appdb';
      const query = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 172.17.0.2:5432'));
      mockGetPool.mockReturnValue({ query } as never);
      const status = await probeDatabase();
      expect(status.ok).toBe(false);
      expect(status.detail).toContain('172.17.0.2:5432');
    });
  });

  describe('probeVoiceStatus', () => {
    it('sidecar health → tts/stt flags + endpoint', async () => {
      mockProbeVoice.mockResolvedValue({
        ok: true,
        health: { tts: true, stt: false, voices: [], languages: [], default_voice: {} },
      });
      const status = await probeVoiceStatus();
      expect(status).toMatchObject({
        ok: true,
        tts: true,
        stt: false,
        endpoint: 'http://127.0.0.1:8765',
      });
    });

    it('unreachable sidecar → detailed failure', async () => {
      mockProbeVoice.mockResolvedValue({ ok: false, detail: 'Verbindung verweigert (Port frei?)' });
      const status = await probeVoiceStatus();
      expect(status.ok).toBe(false);
      expect(status.tts).toBe(false);
      expect(status.detail).toContain('Port frei');
    });
  });

  describe('getSystemStatus', () => {
    it('assembles uptime + api instance + all three probes', async () => {
      mockProviderName.mockReturnValue('openai');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
      mockGetPool.mockReturnValue({ query: vi.fn().mockResolvedValue({}) } as never);
      mockProbeVoice.mockResolvedValue({
        ok: true,
        health: { tts: true, stt: true, voices: [], languages: [], default_voice: {} },
      });
      try {
        const status = await getSystemStatus();
        expect(status.uptime).toBeGreaterThanOrEqual(0);
        expect(status.api).toMatchObject({ host: '127.0.0.1', port: 4001 });
        expect(status.api.ip).toBeTypeOf('string');
        expect(status.llm).toMatchObject({ provider: 'openai', ok: true });
        expect(status.voice).toMatchObject({ ok: true, tts: true });
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
