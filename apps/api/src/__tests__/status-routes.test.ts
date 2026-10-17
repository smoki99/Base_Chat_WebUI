import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getSystemStatus } from '../services/statusService';

vi.mock('../services/statusService', () => ({ getSystemStatus: vi.fn() }));
const mockGetSystemStatus = vi.mocked(getSystemStatus);

describe('GET /api/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleStatus = {
    uptime: 42,
    api: { host: '127.0.0.1', port: 4001, ip: '192.168.1.10' }, // eslint-disable-line sonarjs/no-hardcoded-ip
    llm: {
      ok: true,
      configured: true,
      provider: 'openai' as const,
      endpoint: 'http://localhost:1234/v1',
    },
    database: { ok: false, configured: true, endpoint: 'localhost:5432', detail: 'ECONNREFUSED' },
    voice: {
      ok: false,
      configured: true,
      tts: false,
      stt: false,
      endpoint: 'http://127.0.0.1:8765',
      detail: 'timeout',
    },
  };

  it('returns the probed system status wrapped in { data }', async () => {
    mockGetSystemStatus.mockResolvedValue(sampleStatus);
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: sampleStatus });
  });

  it('returns 500 with a safe error when the probe layer throws', async () => {
    mockGetSystemStatus.mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});
