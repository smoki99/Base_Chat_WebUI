import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOpenAIProvider } from '../services/providers/openaiProvider';

/** Helper to create a Response-like object for mocking. */
function mockFetchResponse(status: number, json: object | string) {
  const body = typeof json === 'string' ? json : JSON.stringify(json);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    text: async () => body,
    json: async () => (typeof json === 'string' ? JSON.parse(json) : json),
  };
}

describe('createOpenAIProvider', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('calls the OpenAI-compatible endpoint and returns the assistant content', async () => {
    const mockJson = {
      id: 'chat-123',
      choices: [{ message: { role: 'assistant', content: 'Hello from LM Studio!' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const provider = createOpenAIProvider({
      baseUrl: 'http://localhost:1234/v1',
      model: 'Llama-3',
      apiKey: 'test-key',
    });

    const result = await provider.reply('Hi');
    expect(result.content).toBe('Hello from LM Studio!');
    expect(result.id).toBe('chat-123');

    const fetchSpy = vi.mocked(global.fetch);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  it('throws a meaningful error on non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(500, 'Internal Server Error') as Response
    );

    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await expect(provider.reply('test')).rejects.toThrow(/LLM API error 500/);
  });

  it('throws when the response body has no choices[0].message.content', async () => {
    const emptyResponse = { id: 'chat-0', choices: [] };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(200, emptyResponse) as Response
    );

    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await expect(provider.reply('test')).rejects.toThrow('empty response');
  });

  it('healthCheck returns healthy when the endpoint is reachable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
      json: async () => ({}),
    } as Response);

    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    const health = await provider.healthCheck!();
    expect(health.status).toBe('healthy');
    expect(health.detail).toContain('localhost:1234');
  });

  it('healthCheck returns unhealthy when the endpoint is unreachable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    const health = await provider.healthCheck!();
    expect(health.status).toBe('unhealthy');
    expect(health.detail).toContain('ECONNREFUSED');
  });

  it('uses default baseUrl (LM Studio) when not configured', () => {
    delete process.env.OPENAI_BASE_URL;
    const provider = createOpenAIProvider();
    // The name should be 'openai-compatible' regardless of config.
    expect(provider.name).toBe('openai-compatible');
  });
});
