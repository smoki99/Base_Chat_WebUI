import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getCapabilities, synthesize, transcribe } from '../services/voiceClient';

vi.mock('../services/voiceClient', () => ({
  getCapabilities: vi.fn(),
  synthesize: vi.fn(),
  transcribe: vi.fn(),
}));

describe('voice routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/voice/capabilities returns capabilities', async () => {
    const caps = {
      tts: true,
      stt: true,
      voices: [],
      languages: ['de'],
      defaultVoiceByLanguage: {},
    };
    vi.mocked(getCapabilities).mockResolvedValue(caps);

    const res = await request(app).get('/api/voice/capabilities');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: caps });
  });

  it('POST /api/voice/tts returns 400 when text is missing', async () => {
    const res = await request(app).post('/api/voice/tts').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/text/);
  });

  it('POST /api/voice/tts returns 400 when text is too long', async () => {
    const res = await request(app)
      .post('/api/voice/tts')
      .send({ text: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('POST /api/voice/tts returns audio on success', async () => {
    vi.mocked(synthesize).mockResolvedValue({
      audio: Buffer.from([1, 2, 3]),
      contentType: 'audio/mpeg',
    });

    const res = await request(app).post('/api/voice/tts').send({ text: 'Hallo', voice: 'de-DE' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mpeg');
  });

  it('POST /api/voice/tts returns 500 when synthesize fails', async () => {
    vi.mocked(synthesize).mockRejectedValue(new Error('tts: boom'));

    const res = await request(app).post('/api/voice/tts').send({ text: 'Hallo' });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('POST /api/voice/stt returns 400 when audio is missing', async () => {
    const res = await request(app).post('/api/voice/stt').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/voice/stt returns transcript on success', async () => {
    vi.mocked(transcribe).mockResolvedValue('Hallo wie geht es dir');

    const res = await request(app)
      .post('/api/voice/stt')
      .send({ audio: Buffer.from('fake').toString('base64'), language: 'de' });
    expect(res.status).toBe(200);
    expect(res.body.data.text).toBe('Hallo wie geht es dir');
  });

  it('POST /api/voice/stt returns 500 when transcribe fails', async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error('stt: boom'));

    const res = await request(app)
      .post('/api/voice/stt')
      .send({ audio: Buffer.from('fake').toString('base64') });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
