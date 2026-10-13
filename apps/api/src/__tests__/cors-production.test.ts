import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Deterministic production scenario: fail-closed CORS with an empty allowlist.
process.env.NODE_ENV = 'production';
process.env.CORS_ORIGIN = '';

const { default: app } = await import('../app');

describe('CORS fail-closed (production)', () => {
  it('denies cross-origin requests when CORS_ORIGIN is empty and NODE_ENV=production', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.test');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still allows explicitly listed origins in production', async () => {
    process.env.CORS_ORIGIN = 'http://ok.test, http://also-ok.test';
    const res = await request(app).get('/health').set('Origin', 'http://also-ok.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://also-ok.test');
  });

  it('still allows non-browser requests (no Origin header) in production', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
