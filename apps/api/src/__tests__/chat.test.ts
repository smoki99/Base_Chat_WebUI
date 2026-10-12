import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { chatService } from '../services/chatService';

describe('POST /api/chat', () => {
  it('responds with 201 and a { data: { id, content } } payload', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hallo' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('content');
  });

  it('returns a random pool response when no keyword matches', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hello World' });
    const pool = [
      'Interesting! Tell me more. 🤖',
      'Noted! (random mock answer #1)',
      "I'm a mock bot, but I love small talk. (random mock answer #2)",
    ];
    expect(pool).toContain(res.body.data.content);
  });

  it('returns 400 with an error when message is missing', async () => {
    const res = await request(app).post('/api/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('message');
  });

  it('returns 400 with an error when message is not a string', async () => {
    const res = await request(app).post('/api/chat').send({ message: 123 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 with an error when message is empty or whitespace', async () => {
    const res = await request(app).post('/api/chat').send({ message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('answers the greeting keyword with the canned reply', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Guten Tag' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Hallo! Wie kann ich helfen?');
  });

  it('matches keywords case-insensitively', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'GUTEN TAG!' });
    expect(res.body.data.content).toBe('Hallo! Wie kann ich helfen?');
  });

  it('answers the t-shirt keyword with the size info', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Welche Größen hast du fürs TShirt?' });
    expect(res.body.data.content).toBe('Wir haben T-Shirts in S, M, L und XL.');
  });

  it('answers the farewell keyword with a goodbye', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Bye Bye' });
    expect(['Auf Wiedersehen!', 'Bis bald! 👋']).toContain(res.body.data.content);
  });

  it('falls back to the random pool when no keyword matches', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Was gibt es Neues?' });
    const pool = [
      'Interesting! Tell me more. 🤖',
      'Noted! (random mock answer #1)',
      "I'm a mock bot, but I love small talk. (random mock answer #2)",
    ];
    expect(pool).toContain(res.body.data.content);
  });
});

describe('GET /api/chat/health', () => {
  it('returns 200 with healthy status for the mock provider', async () => {
    const res = await request(app).get('/api/chat/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        status: 'healthy',
        provider: 'mock',
      })
    );
  });

  it('includes a detail message', async () => {
    const res = await request(app).get('/api/chat/health');
    expect(res.body.data).toHaveProperty('detail');
    expect(typeof res.body.data.detail).toBe('string');
  });

  it('returns the provider name that matches the configured provider', async () => {
    const res = await request(app).get('/api/chat/health');
    expect(res.body.data.provider).toBe(chatService.getProviderName());
  });
});
