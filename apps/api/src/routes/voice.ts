import { Router } from 'express';
import { getCapabilities, synthesize, transcribe } from '../services/voiceClient';
import type { ApiResponse, SttRequest, SttResult, TtsRequest } from 'shared';

export const voiceRouter = Router();

// GET /api/voice/capabilities – availability + voices.
voiceRouter.get('/api/voice/capabilities', async (_req, res) => {
  const caps = await getCapabilities();
  res.json({ data: caps });
});

// POST /api/voice/tts – synthesize speech → audio.
voiceRouter.post('/api/voice/tts', async (req, res, next) => {
  const body = req.body as Partial<TtsRequest>;
  const text = body?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: { message: 'text is required' } });
    return;
  }
  if (text.length > 2000) {
    res.status(400).json({ error: { message: 'text must be at most 2000 characters' } });
    return;
  }
  try {
    const { audio, contentType } = await synthesize(text.trim(), body.voice);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', audio.length);
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// POST /api/voice/stt – transcribe audio → text.
voiceRouter.post('/api/voice/stt', async (req, res, next) => {
  const body = req.body as Partial<SttRequest>;
  const audio = body?.audio;
  if (typeof audio !== 'string' || audio.length === 0) {
    res.status(400).json({ error: { message: 'audio (base64) is required' } });
    return;
  }
  const language = typeof body?.language === 'string' ? body.language : 'de';
  const audioBuffer = Buffer.from(audio, 'base64');
  try {
    const text = await transcribe(audioBuffer, language);
    res.json({ data: { text } } satisfies ApiResponse<SttResult>);
  } catch (err) {
    next(err);
  }
});
