import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '../hooks/useChat';

/**
 * Deferred /api/chat mock: lets a test keep a request "in flight" (isLoading
 * true) until it explicitly resolves the reply.
 */
function mockDeferredChat() {
  let resolveReply: (() => void) | undefined;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/chat')) {
      return new Promise((resolve) => {
        resolveReply = () =>
          resolve({
            ok: true,
            json: async () => ({ data: { id: 'r1', content: 'Antwort' } }),
          } as unknown as Response);
      });
    }
    // voice capabilities (not needed by useChat, but keep fetch happy)
    return Promise.resolve({
      ok: true,
      json: async () => ({
        data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
      }),
    } as unknown as Response);
  });
  return {
    fetchMock,
    chatCalls: () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/chat')),
    resolveReply: () => resolveReply?.(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useChat.send()', () => {
  it('blocks a new instruction while a previous request is still in flight', async () => {
    const { chatCalls, resolveReply } = mockDeferredChat();
    const { result } = renderHook(() => useChat());

    // First instruction goes out.
    await act(async () => {
      void result.current.send('erste Anweisung');
    });
    expect(result.current.isLoading).toBe(true);
    expect(chatCalls()).toHaveLength(1);

    // A second instruction arrives while the first is still pending.
    await act(async () => {
      void result.current.send('zweite Anweisung');
    });

    // Guard must drop the second one – only one request is allowed in flight.
    expect(chatCalls()).toHaveLength(1);

    // Let the first reply land.
    await act(async () => {
      resolveReply();
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.messages).toHaveLength(2); // user + assistant
  });
});
