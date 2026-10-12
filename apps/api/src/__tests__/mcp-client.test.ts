import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

type WriteFn = (data: string) => void;

interface FakeChild {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: WriteFn };
  kill: ReturnType<typeof vi.fn>;
  on: (event: string, handler: (...args: unknown[]) => void) => FakeChild;
}

function createFakeMcpServer(options?: {
  tools?: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
  toolResult?: string;
  fail?: boolean;
}): FakeChild {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();

  const tools = options?.tools ?? [
    {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    },
  ];
  const toolResultText = options?.toolResult ?? 'file content here';

  const stdinWrite: WriteFn = (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    if (options?.fail) {
      if (msg.id !== undefined) {
        const resp = JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32000, message: 'server error' },
        });
        setTimeout(() => stdout.emit('data', Buffer.from(resp + '\n')), 0);
      }
      return;
    }

    const method = msg.method as string;

    if (method === 'initialize') {
      const resp = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: { name: 'test-server', version: '1.0' },
        },
      });
      setTimeout(() => stdout.emit('data', Buffer.from(resp + '\n')), 0);
    } else if (method === 'tools/list') {
      const resp = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools } });
      setTimeout(() => stdout.emit('data', Buffer.from(resp + '\n')), 0);
    } else if (method === 'tools/call') {
      const resp = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { content: [{ type: 'text', text: toolResultText }] },
      });
      setTimeout(() => stdout.emit('data', Buffer.from(resp + '\n')), 0);
    }
  };

  const self = {
    stdout,
    stderr,
    stdin: { write: stdinWrite },
    kill: vi.fn(),
    on: (_event: string, _handler: (...args: unknown[]) => void) => self,
  } as FakeChild;
  return self;
}

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { loadMcpConfig, connectAllMcpServers } from '../services/mcpClient';
import { chatService, initializeMcp } from '../services/chatService';

const mockSpawn = vi.mocked(spawn);

const tmpDir = join(process.cwd(), '__tmp_test__');
const tmpConfig = join(tmpDir, 'mcp-config.json');

function setupTmpDir() {
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
}

function teardownTmpDir() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
}

describe('loadMcpConfig', () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => {
    teardownTmpDir();
    vi.resetAllMocks();
  });

  it('returns the servers array from a valid config file', () => {
    const config = {
      servers: [{ name: 'test', command: 'node', args: ['server.js'], enabled: true }],
    };
    writeFileSync(tmpConfig, JSON.stringify(config));

    const result = loadMcpConfig(tmpConfig);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('test');
    expect(result[0]!.command).toBe('node');
  });

  it('returns an empty array when the file does not exist', () => {
    const result = loadMcpConfig('/nonexistent/path.json');
    expect(result).toEqual([]);
  });

  it('returns an empty array when the JSON is malformed', () => {
    writeFileSync(tmpConfig, '{ bad json !!!');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = loadMcpConfig(tmpConfig);
    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('uses MCP_CONFIG_FILE env var when no path is given', () => {
    const config = { servers: [{ name: 'env-server', command: 'node', args: [] }] };
    writeFileSync(tmpConfig, JSON.stringify(config));
    process.env.MCP_CONFIG_FILE = tmpConfig;

    const result = loadMcpConfig();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('env-server');
    delete process.env.MCP_CONFIG_FILE;
  });
});

describe('connectAllMcpServers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to a server, discovers tools, and qualifies them', async () => {
    const fake = createFakeMcpServer({
      tools: [
        { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object' } },
      ],
    });
    mockSpawn.mockReturnValue(fake as unknown as ReturnType<typeof spawn>);

    const configs = [{ name: 'fs', command: 'node', args: ['server.js'] }];
    const ctx = await connectAllMcpServers(configs);

    expect(ctx.connections).toHaveLength(1);
    expect(ctx.allTools).toHaveLength(2);
    expect(ctx.allTools[0]!.name).toBe('fs.read_file');
    expect(ctx.allTools[1]!.name).toBe('fs.write_file');
    expect(ctx.toolHandlers.size).toBe(2);
  });

  it('calls the tool handler and returns the text result', async () => {
    const fake = createFakeMcpServer({ toolResult: 'hello world' });
    mockSpawn.mockReturnValue(fake as unknown as ReturnType<typeof spawn>);

    const configs = [{ name: 'test', command: 'node', args: [] }];
    const ctx = await connectAllMcpServers(configs);

    const handler = ctx.toolHandlers.get('test.read_file');
    expect(handler).toBeDefined();
    const result = await handler!({ path: 'relative/file.txt' });
    expect(result).toBe('hello world');
  });

  it('skips a server that fails to connect without crashing', async () => {
    const fake = createFakeMcpServer({ fail: true });
    mockSpawn.mockReturnValue(fake as unknown as ReturnType<typeof spawn>);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const configs = [{ name: 'bad', command: 'node', args: [] }];
    const ctx = await connectAllMcpServers(configs);

    expect(ctx.connections).toHaveLength(0);
    expect(ctx.allTools).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('closeAll kills all child processes', async () => {
    const fake = createFakeMcpServer();
    mockSpawn.mockReturnValue(fake as unknown as ReturnType<typeof spawn>);

    const configs = [{ name: 'fs', command: 'node', args: [] }];
    const ctx = await connectAllMcpServers(configs);

    ctx.closeAll();
    expect(fake.kill).toHaveBeenCalled();
  });
});

describe('chatService MCP integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    chatService.resetProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    chatService.resetProvider();
  });

  it('initializeMcp is a no-op when no config file exists', async () => {
    process.env.MCP_CONFIG_FILE = '/nonexistent/mcp.json';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initializeMcp();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No MCP servers'));
    delete process.env.MCP_CONFIG_FILE;
  });

  it('respond works with MCP tools available', async () => {
    const fake = createFakeMcpServer({
      tools: [{ name: 'query', description: 'SQL query', inputSchema: { type: 'object' } }],
      toolResult: 'rows: 3',
    });
    mockSpawn.mockReturnValue(fake as unknown as ReturnType<typeof spawn>);

    setupTmpDir();
    const config = { servers: [{ name: 'pg', command: 'node', args: [] }] };
    writeFileSync(tmpConfig, JSON.stringify(config));
    process.env.MCP_CONFIG_FILE = tmpConfig;
    process.env.CHAT_PROVIDER = 'openai';

    const openaiResponse = {
      id: 'chat-test',
      choices: [{ message: { role: 'assistant', content: '3 rows found' } }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(openaiResponse),
      json: async () => openaiResponse,
    }) as unknown as typeof fetch;

    await initializeMcp();
    const result = await chatService.respond('Give me products from Berlin');
    expect(result.content).toBe('3 rows found');

    teardownTmpDir();
    delete process.env.MCP_CONFIG_FILE;
    delete process.env.CHAT_PROVIDER;
  });

  it('closeMcp clears the MCP context', async () => {
    chatService.closeMcp();
    const result = await chatService.respond('hello');
    expect(result.content).toBeTruthy();
  });
});
