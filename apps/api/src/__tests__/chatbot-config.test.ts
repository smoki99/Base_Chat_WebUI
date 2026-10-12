import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

// We mock node:fs readFileSync to control file contents without real I/O.
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, readFileSync: vi.fn() };
});

// Import AFTER the mock is registered so the mocked readFileSync is used.
const { loadChatbotConfig, DEFAULT_CONFIG } = await import('../config/chatbotConfig');

const mockReadFileSync = vi.mocked(readFileSync);

describe('loadChatbotConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CHATBOT_RULES_FILE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the parsed config when the JSON is valid', () => {
    const validConfig = {
      keywords: [{ keyword: 'hi', responses: ['Hello!'] }],
      randomResponses: ['Generic reply'],
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

    const result = loadChatbotConfig('/some/path.json');
    expect(result).toEqual(validConfig);
    expect(mockReadFileSync).toHaveBeenCalledWith('/some/path.json', 'utf-8');
  });

  it('falls back to DEFAULT_CONFIG when the JSON structure is invalid', () => {
    // Structurally invalid: missing keywords array
    mockReadFileSync.mockReturnValue(JSON.stringify({ foo: 'bar' }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadChatbotConfig('/some/path.json');
    expect(result).toEqual(DEFAULT_CONFIG);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to DEFAULT_CONFIG when readFileSync throws (file not found)', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadChatbotConfig('/nonexistent/path.json');
    expect(result).toEqual(DEFAULT_CONFIG);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to DEFAULT_CONFIG when JSON.parse fails (malformed JSON)', () => {
    mockReadFileSync.mockReturnValue('{ invalid json !!!');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadChatbotConfig('/some/path.json');
    expect(result).toEqual(DEFAULT_CONFIG);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('uses the CHATBOT_RULES_FILE env var as default path when no argument is given', () => {
    process.env.CHATBOT_RULES_FILE = '/env/path.json';
    const validConfig = {
      keywords: [{ keyword: 'test', responses: ['ok'] }],
      randomResponses: ['fallback'],
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

    const result = loadChatbotConfig();
    expect(result).toEqual(validConfig);
    expect(mockReadFileSync).toHaveBeenCalledWith('/env/path.json', 'utf-8');
  });
});
