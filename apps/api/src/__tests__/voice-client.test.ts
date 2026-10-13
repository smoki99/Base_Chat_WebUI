import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCapabilities,
  synthesize,
  transcribe,
  invalidateCapabilitiesCache,
} from '../services/voiceClient';

beforeEach(() => {
  invalidateCapabilitiesCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('voiceClient.getCapabilities', () => {
  it('returns tts/stt availability + voices when the sidecar is up', async () => {
    const health = {
      tts: true,
      stt: true,
      voices: [{ id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'f', language: 'de' }],
      languages: ['de', 'es', 'en'],
      default_voice: { de: 'de-DE-KatjaNeural', es: 'es-ES-ElviraNeural', en: 'en-US-JennyNeural' },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => health,
    } as unknown as Response);

    const caps = await getCapabilities();
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(true);
    expect(caps.voices).toHaveLength(1);
    expect(caps.voices[0]!.id).toBe('de-DE-KatjaNeural');
    expect(caps.languages).toEqual(['de', 'es', 'en']);
    expect(caps.defaultVoiceByLanguage).toEqual(health.default_voice);
  });

  it('reports both unavailable when the sidecar is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const caps = await getCapabilities();
    expect(caps.tts).toBe(false);
    expect(caps.stt).toBe(false);
    expect(caps.voices).toHaveLength(0);
    expect(caps.languages).toHaveLength(0);
  });

  it('reports both unavailable when the sidecar returns a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    const caps = await getCapabilities();
    expect(caps.tts).toBe(false);
    expect(caps.stt).toBe(false);
  });

  it('caches capabilities within the TTL window', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tts: true,
        stt: true,
        voices: [],
        languages: ['de'],
        default_voice: { de: 'x' },
      }),
    } as unknown as Response);

    await getCapabilities();
    await getCapabilities();
    // Second call is served from the cache → only one fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('voiceClient.synthesize', () => {
  it('returns audio bytes + content type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: {
        get: (n: string) => (n.toLowerCase() === 'content-type' ? 'audio/mpeg' : null),
      },
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response);

    const result = await synthesize('Hallo Welt', 'de-DE-KatjaNeural');
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.audio).toHaveLength(4);
    expect(result.contentType).toBe('audio/mpeg');
  });

  it('throws when the sidecar returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'tts: boom',
    } as unknown as Response);

    await expect(synthesize('Hallo', 'de')).rejects.toThrow(/tts failed/);
  });
});

describe('voiceClient.transcribe', () => {
  it('returns the transcript text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hallo wie geht es dir' }),
    } as unknown as Response);

    const text = await transcribe(Buffer.from('fake-audio'), 'de');
    expect(text).toBe('Hallo wie geht es dir');
  });

  it('throws when the sidecar returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'STT not ready',
    } as unknown as Response);

    await expect(transcribe(Buffer.from('fake'), 'de')).rejects.toThrow(/stt failed/);
  });
});
