import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

// Tests assume the mock provider (deterministic, no external LLM).
process.env.CHAT_PROVIDER = 'mock';

describe('Security headers (helmet)', () => {
  it('responds with X-Content-Type-Options: nosniff on GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('responds with Referrer-Policy: no-referrer on GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('responds with X-Frame-Options: SAMEORIGIN on GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('does not expose X-Powered-By on GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('responds with security headers on POST /api/chat', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hello' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });
});
