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

    await expect(provider.reply('test')).rejects.toThrow(/no content after 0 tool round/);
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

  it('falls back to tool results when LLM returns null content after tool call', async () => {
    // First response: LLM wants to call a tool
    const toolCallResponse = {
      id: 'chat-tool-1',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: { name: 'qmd.query', arguments: '{"query":"Hamburg Produkte"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
    // Second response: LLM returns null content (can't synthesize)
    const nullContentResponse = {
      id: 'chat-tool-2',
      choices: [{ message: { role: 'assistant', content: null } }],
    };

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(200, toolCallResponse) as Response)
      .mockResolvedValueOnce(mockFetchResponse(200, nullContentResponse) as Response);

    const toolHandler = vi.fn().mockResolvedValue('Found: Hamburg Produkt A, Produkt B');
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    const result = await provider.reply('Hamburg was kann ich da kaufen?', {
      tools: [{ name: 'qmd.query', description: 'Search', parameters: {} }],
      toolHandlers: new Map([['qmd.query', toolHandler]]),
    });

    // The tool result is used as fallback content
    expect(result.content).toBe('Found: Hamburg Produkt A, Produkt B');
    expect(toolHandler).toHaveBeenCalledWith({ query: 'Hamburg Produkte' });
  });

  it('returns LLM content normally when tool is called and LLM synthesizes a response', async () => {
    const toolCallResponse = {
      id: 'chat-tool-3',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_xyz',
                type: 'function',
                function: { name: 'qmd.query', arguments: '{"query":"test"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
    const synthesizedResponse = {
      id: 'chat-tool-4',
      choices: [{ message: { role: 'assistant', content: 'Hier sind die Ergebnisse...' } }],
    };

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(200, toolCallResponse) as Response)
      .mockResolvedValueOnce(mockFetchResponse(200, synthesizedResponse) as Response);

    const toolHandler = vi.fn().mockResolvedValue('raw tool data');
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    const result = await provider.reply('test query', {
      tools: [{ name: 'qmd.query', description: 'Search', parameters: {} }],
      toolHandlers: new Map([['qmd.query', toolHandler]]),
    });

    // LLM synthesized content is preferred over raw tool result
    expect(result.content).toBe('Hier sind die Ergebnisse...');
  });

  it('uses default baseUrl (LM Studio) when not configured', () => {
    delete process.env.OPENAI_BASE_URL;
    const provider = createOpenAIProvider();
    // The name should be 'openai-compatible' regardless of config.
    expect(provider.name).toBe('openai-compatible');
  });

  it('uses SQL system prompt when sql tools are provided', async () => {
    const mockJson = {
      id: 'chat-sql-1',
      choices: [{ message: { role: 'assistant', content: 'Found: Fischbrötchen' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const sqlTools = [
      {
        name: 'sql.search_products',
        description: 'Search products',
        parameters: { type: 'object' },
      },
      {
        name: 'sql.get_product',
        description: 'Get product by SKU',
        parameters: { type: 'object' },
      },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Was gibt es in Hamburg?', { tools: sqlTools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('sql.search_products');
    expect(systemMsg.content).toContain('Maximum 2 tool calls');
  });

  it('uses combined system prompt when both sql and qmd tools are provided', async () => {
    const mockJson = {
      id: 'chat-combined-1',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const combinedTools = [
      { name: 'sql.search_products', description: 'Search', parameters: { type: 'object' } },
      { name: 'qmd.query', description: 'Search docs', parameters: { type: 'object' } },
      { name: 'qmd.multi_get', description: 'Get docs', parameters: { type: 'object' } },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Was gibt es?', { tools: combinedTools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('Routing Rules');
    expect(systemMsg.content).toContain('sql.search_products');
    expect(systemMsg.content).toContain('qmd.query');
  });

  it('uses the admin-db system prompt when only admin-db tools are provided', async () => {
    const mockJson = {
      id: 'chat-admin-1',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const adminTools = [
      { name: 'admin-db.list_tables', description: 'List tables', parameters: { type: 'object' } },
      {
        name: 'admin-db.search_tables',
        description: 'Search tables',
        parameters: { type: 'object' },
      },
      {
        name: 'admin-db.run_sql',
        description: 'Run read-only SQL',
        parameters: { type: 'object' },
      },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Welche Tabellen gibt es?', { tools: adminTools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('admin-db.list_tables');
    expect(systemMsg.content).toContain('admin-db.run_sql');
    expect(systemMsg.content).toMatch(/read-only/i);
    expect(systemMsg.content).not.toContain('sql.search_products');
  });

  it('combines the sql and admin-db prompts when both tool families are provided', async () => {
    const mockJson = {
      id: 'chat-sql-admin-1',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const tools = [
      { name: 'sql.search_products', description: 'Search', parameters: { type: 'object' } },
      { name: 'admin-db.run_sql', description: 'Run SQL', parameters: { type: 'object' } },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Was gibt es?', { tools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('sql.search_products');
    expect(systemMsg.content).toContain('admin-db.list_tables');
    expect(systemMsg.content).toContain('Routing Rules');
  });

  it('QMD prompt instructs to split compound words and avoid padding', async () => {
    const mockJson = {
      id: 'chat-qmd-1',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const qmdTools = [
      { name: 'qmd.query', description: 'Search docs', parameters: { type: 'object' } },
      { name: 'qmd.multi_get', description: 'Get docs', parameters: { type: 'object' } },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Wie macht man Matjesbrot?', { tools: qmdTools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('AND-based');
    expect(systemMsg.content).toContain('SPLIT');
    expect(systemMsg.content).toContain('Never copy the tool');
  });

  it('SQL prompt instructs to rephrase no-results in own words', async () => {
    const mockJson = {
      id: 'chat-sql-2',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const sqlTools = [
      {
        name: 'sql.search_products',
        description: 'Search products',
        parameters: { type: 'object' },
      },
      {
        name: 'sql.get_product',
        description: 'Get product by SKU',
        parameters: { type: 'object' },
      },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Gibt es Pizza?', { tools: sqlTools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('Never copy the tool');
    expect(systemMsg.content).toContain('own words');
  });

  it('combined prompt includes query-crafting and no-results rules', async () => {
    const mockJson = {
      id: 'chat-combined-2',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const combinedTools = [
      { name: 'sql.search_products', description: 'Search', parameters: { type: 'object' } },
      { name: 'qmd.query', description: 'Search docs', parameters: { type: 'object' } },
      { name: 'qmd.multi_get', description: 'Get docs', parameters: { type: 'object' } },
    ];
    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });

    await provider.reply('Was gibt es?', { tools: combinedTools });

    const fetchSpy = vi.mocked(global.fetch);
    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system')!;
    expect(systemMsg.content).toContain('AND-based');
    expect(systemMsg.content).toContain('SPLIT');
    expect(systemMsg.content).toContain('Never copy the tool');
  });

  it('catches tool handler errors and returns the error as tool result', async () => {
    const mockJson = {
      id: 'chat-err',
      choices: [{ message: { role: 'assistant', content: 'Tool failed' } }],
    };
    // First call: tool_call response. Second call: final content.
    const toolCallJson = {
      id: 'chat-err',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'tc1', type: 'function', function: { name: 'bad_tool', arguments: '{}' } },
            ],
          },
        },
      ],
    };
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(200, toolCallJson) as Response)
      .mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const provider = createOpenAIProvider({
      baseUrl: 'http://localhost:1234/v1',
      model: 'Llama-3',
      apiKey: 'test-key',
    });

    const badHandler = vi.fn().mockRejectedValue(new Error('handler boom'));
    const result = await provider.reply('test', {
      tools: [{ name: 'bad_tool', description: 'x', parameters: {} }],
      toolHandlers: new Map([['bad_tool', badHandler]]),
    });
    expect(result.content).toBe('Tool failed');
  });

  it('includes history messages in the request body', async () => {
    const mockJson = {
      id: 'chat-hist',
      choices: [{ message: { role: 'assistant', content: 'I remember' } }],
    };
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(200, mockJson) as Response);

    const provider = createOpenAIProvider({
      baseUrl: 'http://localhost:1234/v1',
      model: 'Llama-3',
      apiKey: 'test-key',
    });

    await provider.reply('current question', {
      history: [
        { role: 'user', content: 'earlier question' },
        { role: 'assistant', content: 'earlier answer' },
      ],
    });

    const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    const roles = body.messages.map((m: { role: string }) => m.role);
    expect(roles).toContain('user');
    expect(body.messages.some((m: { content: string }) => m.content === 'earlier question')).toBe(
      true
    );
    expect(body.messages.some((m: { content: string }) => m.content === 'earlier answer')).toBe(
      true
    );
  });

  it('throws a timeout error when the request exceeds timeoutMs', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(
            () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            10
          );
          return timer;
        })
    );

    const provider = createOpenAIProvider({
      baseUrl: 'http://localhost:1234/v1',
      model: 'Llama-3',
      apiKey: 'test-key',
      timeoutMs: 5,
    });

    await expect(provider.reply('test')).rejects.toThrow(/timed out/i);
  });
});

describe('custom prompt extension (Story-0036)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  function sentSystemPrompt(): string {
    const fetchSpy = vi.mocked(global.fetch);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    return body.messages[0].content;
  }

  it('appends the custom prompt section before the voice instruction', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(200, {
        id: 'c-1',
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }) as Response
    );

    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });
    await provider.reply('Hi', { customPrompt: 'SKU means "Artikelnummer".' });

    const systemPrompt = sentSystemPrompt();
    expect(systemPrompt).toContain('## Additional instructions');
    expect(systemPrompt).toContain('SKU means "Artikelnummer".');
    // The voice summary instruction must stay last.
    expect(systemPrompt.indexOf('## Additional instructions')).toBeLessThan(
      systemPrompt.indexOf('## Voice Summary')
    );
  });

  it('keeps the system prompt unchanged when customPrompt is empty or whitespace', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockFetchResponse(200, {
        id: 'c-2',
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }) as Response
    );

    const provider = createOpenAIProvider({ baseUrl: 'http://localhost:1234/v1' });
    await provider.reply('Hi', { customPrompt: '   ' });

    expect(sentSystemPrompt()).not.toContain('## Additional instructions');
  });
});
