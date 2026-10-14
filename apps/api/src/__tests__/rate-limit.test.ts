import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// Limits must be set BEFORE importing the app (app.ts reads them at module load).
process.env.RATE_LIMIT_GENERAL = '3';
process.env.RATE_LIMIT_VOICE = '2';

const { default: app, resetRateLimits } = await import('../app');

describe('rate limiting (express-rate-limit)', () => {
  beforeEach(async () => {
    await resetRateLimits();
  });

  it('allows requests up to the general limit, then answers 429', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/chat').send({ message: 'hallo' });
      expect(res.status).toBe(201);
    }

    const blocked = await request(app).post('/api/chat').send({ message: 'hallo' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toBe('Rate limit exceeded, please slow down');
    // Standard (draft-ietf) rate-limit headers are present.
    expect(blocked.headers.ratelimit).toBeDefined();
  });

  it('enforces the stricter voice limit on /api/voice/*', async () => {
    // Invalid bodies fail fast (400) before any sidecar call – safe without a running voz.
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post('/api/voice/tts').send({ text: '' });
      expect(res.status).toBe(400);
    }

    const blocked = await request(app).post('/api/voice/tts').send({ text: '' });
    expect(blocked.status).toBe(429);
  });

  it('does not rate-limit /health', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('counts general and voice routes in separate buckets', async () => {
    // Exhaust the general bucket...
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/chat').send({ message: 'hallo' });
    }
    expect((await request(app).post('/api/chat').send({ message: 'hallo' })).status).toBe(429);

    // ...the voice bucket (limit = 2) must still have capacity.
    const voice = await request(app).post('/api/voice/tts').send({ text: '' });
    expect(voice.status).toBe(400); // not 429
  });
});
