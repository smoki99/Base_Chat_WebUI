import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useVoice } from '../hooks/useVoice';

const capsPayload = {
  data: {
    tts: true,
    stt: true,
    voices: [{ id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'f', language: 'de' }],
    languages: ['de', 'es', 'en'],
    defaultVoiceByLanguage: { de: 'de-DE-KatjaNeural' },
  },
};

function mockCapabilities() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/voice/capabilities')) {
      return { ok: true, json: async () => capsPayload } as unknown as Response;
    }
    if (url.includes('/api/voice/tts')) {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' });
      return { ok: true, blob: async () => blob } as unknown as Response;
    }
    if (url.includes('/api/voice/stt')) {
      return {
        ok: true,
        json: async () => ({ text: 'Hallo wie geht es dir' }),
      } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
}

function mockAudio() {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(globalThis, 'Audio').mockImplementation(function () {
    return { play, pause, onended: null, onerror: null } as unknown as HTMLAudioElement;
  });
  return { play, pause };
}

function mockRecorder() {
  const start = vi.fn();
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop: vi.fn() }] };
  let instance: Record<string, unknown> | null = null;

  class MockMediaRecorder {
    onstop: (() => void) | null = null;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    mimeType = 'audio/webm';
    start = start;
    stop = stop;
    constructor(_s: MediaStream) {
      instance = this as unknown as Record<string, unknown>;
    }
  }

  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    writable: true,
    configurable: true,
  });
  return { start, stop, stream, getInstance: () => instance };
}

describe('useVoice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads capabilities and exposes voices + languages', async () => {
    mockCapabilities();
    const { result } = renderHook(() => useVoice());
    await waitFor(() => {
      expect(result.current.isTtsAvailable).toBe(true);
      expect(result.current.isSttAvailable).toBe(true);
    });
    expect(result.current.voices).toHaveLength(1);
    expect(result.current.voices[0]!.id).toBe('de-DE-KatjaNeural');
    expect(result.current.languages).toEqual(['de', 'es', 'en']);
    expect(result.current.currentVoice).toBe('de-DE-KatjaNeural');
  });

  it('hides voice buttons when sidecar is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const { result } = renderHook(() => useVoice());
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.isTtsAvailable).toBe(false);
    expect(result.current.isSttAvailable).toBe(false);
  });

  it('speak synthesizes and plays audio', async () => {
    mockCapabilities();
    const { play } = mockAudio();
    const { result } = renderHook(() => useVoice());
    await waitFor(() => expect(result.current.isTtsAvailable).toBe(true));
    await act(async () => {
      await result.current.speak('Hallo Welt');
    });
    expect(play).toHaveBeenCalled();
  });

  it('speak sets error on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/voice/tts')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'tts: boom' } }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => capsPayload } as unknown as Response;
    });
    const { result } = renderHook(() => useVoice());
    await waitFor(() => expect(result.current.isTtsAvailable).toBe(true));
    await act(async () => {
      await result.current.speak('Hallo');
    });
    expect(result.current.error).toMatch(/tts/i);
  });

  it('stopSpeaking pauses audio', async () => {
    mockCapabilities();
    const { pause } = mockAudio();
    const { result } = renderHook(() => useVoice());
    await waitFor(() => expect(result.current.isTtsAvailable).toBe(true));
    await act(async () => {
      await result.current.speak('Hallo');
    });
    act(() => {
      result.current.stopSpeaking();
    });
    expect(pause).toHaveBeenCalled();
  });

  it('startRecording starts and stopRecording stops the cycle', async () => {
    mockCapabilities();
    const { start, stop, getInstance } = mockRecorder();
    vi.stubGlobal(
      'FileReader',
      class {
        result: string | null = null;
        onloadend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL(_blob: Blob) {
          this.result = 'data:audio/webm;base64,ZmFrZS1hdWRpbw==';
          this.onloadend?.();
        }
      }
    );

    const { result } = renderHook(() => useVoice());
    await waitFor(() => expect(result.current.isSttAvailable).toBe(true));

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
    expect(start).toHaveBeenCalled();
    expect(result.current.error).toBeNull();

    const inst = getInstance()!;
    act(() => {
      (inst.ondataavailable as (e: { data: Blob }) => void)({ data: new Blob(['fake-audio']) });
    });

    await act(async () => {
      result.current.stopRecording();
      const stopFn = inst.onstop as unknown as () => Promise<void> | void;
      const p = stopFn();
      if (p && typeof (p as Promise<void>).then === 'function') {
        await (p as Promise<void>);
      }
    });

    expect(stop).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
  });

  it('clearTranscript resets the last transcript', async () => {
    mockCapabilities();
    const { result } = renderHook(() => useVoice());
    await waitFor(() => expect(result.current.isSttAvailable).toBe(true));
    act(() => {
      result.current.clearTranscript();
    });
    expect(result.current.lastTranscript).toBeNull();
  });
});
