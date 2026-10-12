import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('POST /api/chat', () => {
  it('responds with 201 and a { data: { id, content } } payload', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hallo' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('content');
  });

  it('returns the mock echo for the given message', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hello World' });
    expect(res.body.data.content).toBe('Echo: Hello World');
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
});
