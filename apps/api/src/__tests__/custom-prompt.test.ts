/**
 * Story-0036 – custom chatbot prompt (system prompt extension).
 *
 * Covers the file-based store (customPromptStore), the admin-protected
 * GET/PUT /api/chat/custom-prompt routes, and the chatService wiring that
 * passes the stored prompt to the provider on every request.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_CUSTOM_PROMPT_CHARS } from 'shared';

// Capture the mock provider's reply() so we can assert the options that
// chatService.respond() passes (hoisted: vi.mock factories may not use
// top-level variables).
const { replyMock } = vi.hoisted(() => ({
  replyMock: vi.fn(async (_message: string, _options?: Record<string, unknown>) => ({
    id: 'mock-1',
    content: 'ok',
  })),
}));
vi.mock('../services/providers/mockProvider', () => ({
  createMockProvider: () => ({ name: 'mock', reply: replyMock }),
}));

import app from '../app';
import { chatService } from '../services/chatService';
import {
  CustomPromptTooLongError,
  loadCustomPrompt,
  saveCustomPrompt,
} from '../services/customPromptStore';

const originalEnv = { ...process.env };
let tmpDir: string;
const promptFile = () => path.join(tmpDir, 'chatbot-custom-prompt.md');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-prompt-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  process.env = { ...originalEnv };
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.ADMIN_TOKEN;
  process.env.CHATBOT_CUSTOM_PROMPT_FILE = promptFile();
  process.env.CHAT_PROVIDER = 'mock';
  chatService.resetProvider();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('customPromptStore', () => {
  it('returns "" when the prompt file does not exist', async () => {
    expect(await loadCustomPrompt()).toBe('');
  });

  it('saves the trimmed content and loads it back', async () => {
    const stored = await saveCustomPrompt('  SKU = Artikelnummer. \n');
    expect(stored).toBe('SKU = Artikelnummer.');
    expect(await loadCustomPrompt()).toBe('SKU = Artikelnummer.');
  });

  it('clears the stored prompt when saving an empty/whitespace string', async () => {
    await saveCustomPrompt('some text');
    await saveCustomPrompt('   ');
    expect(await loadCustomPrompt()).toBe('');
  });

  it('rejects when the trimmed content exceeds MAX_CUSTOM_PROMPT_CHARS', async () => {
    await fs.rm(promptFile(), { force: true }); // clean state (shared tmp dir)
    await expect(saveCustomPrompt('x'.repeat(MAX_CUSTOM_PROMPT_CHARS + 1))).rejects.toBeInstanceOf(
      CustomPromptTooLongError
    );
    await expect(fs.stat(promptFile())).rejects.toThrow();
  });

  it('accepts content of exactly MAX_CUSTOM_PROMPT_CHARS', async () => {
    const stored = await saveCustomPrompt('x'.repeat(MAX_CUSTOM_PROMPT_CHARS));
    expect(stored).toHaveLength(MAX_CUSTOM_PROMPT_CHARS);
  });
});

describe('PUT /api/chat/custom-prompt', () => {
  const auth = { Authorization: 'Bearer secret-token' };

  it('answers 403 without a valid token', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app).put('/api/chat/custom-prompt').send({ content: 'x' });
    expect(res.status).toBe(403);
  });

  it('answers 400 when content is not a string', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app).put('/api/chat/custom-prompt').set(auth).send({ content: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message');
  });

  it('answers 400 when content is longer than MAX_CUSTOM_PROMPT_CHARS', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app)
      .put('/api/chat/custom-prompt')
      .set(auth)
      .send({ content: 'x'.repeat(MAX_CUSTOM_PROMPT_CHARS + 1) });
    expect(res.status).toBe(400);
  });

  it('stores the prompt (readable via GET afterwards)', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app)
      .put('/api/chat/custom-prompt')
      .set(auth)
      .send({ content: '  Begriffe: SKU = Artikelnummer  ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ content: 'Begriffe: SKU = Artikelnummer' });

    const get = await request(app).get('/api/chat/custom-prompt').set(auth);
    expect(get.body.data).toEqual({ content: 'Begriffe: SKU = Artikelnummer' });
  });

  it('clears the stored prompt with an empty string', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    await saveCustomPrompt('old text');
    const res = await request(app).put('/api/chat/custom-prompt').set(auth).send({ content: '' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ content: '' });
    expect(await loadCustomPrompt()).toBe('');
  });
});

describe('chatService.respond custom prompt wiring', () => {
  it('passes the stored custom prompt as options.customPrompt', async () => {
    await saveCustomPrompt('Glossar: SKU = Artikelnummer');
    await chatService.respond('hallo');
    expect(replyMock).toHaveBeenCalledWith(
      'hallo',
      expect.objectContaining({ customPrompt: 'Glossar: SKU = Artikelnummer' })
    );
  });

  it('omits customPrompt when no prompt is stored', async () => {
    await saveCustomPrompt(''); // ensure clean state (shared tmp dir)
    await chatService.respond('hallo');
    const options = replyMock.mock.calls.at(-1)?.[1];
    expect(options?.customPrompt).toBeUndefined();
  });
});

describe('GET /api/chat/custom-prompt', () => {
  it('answers 403 when ADMIN_TOKEN is not configured', async () => {
    const res = await request(app).get('/api/chat/custom-prompt');
    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message');
  });

  it('answers 403 for an invalid token', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app)
      .get('/api/chat/custom-prompt')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(403);
  });

  it('returns the stored prompt with a valid token (no database required)', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    delete process.env.DATABASE_URL;
    await saveCustomPrompt('Glossar: SKU = Artikelnummer');
    const res = await request(app)
      .get('/api/chat/custom-prompt')
      .set('Authorization', 'Bearer secret-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ content: 'Glossar: SKU = Artikelnummer' });
  });
});
