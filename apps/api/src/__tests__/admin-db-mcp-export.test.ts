import { describe, it, expect, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SERVER_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../scripts/admin-db-mcp-server.mjs'
);

type ServerMsg = {
  result?: { content?: Array<{ type: string; text: string }>; tools?: unknown[] };
  error?: { code: number; message: string };
};

interface Server {
  proc: ChildProcess;
  send(msg: Record<string, unknown>): void;
  nextResponse(): Promise<ServerMsg>;
  close(): void;
}

/** Start the MCP server over stdio and collect JSON-RPC lines. */
function startServer(env: NodeJS.ProcessEnv = {}): Server {
  const proc = spawn(process.execPath, [SERVER_PATH], {
    env: {
      ...process.env,
      DATABASE_URL: 'postgres://nouser:nopass@127.0.0.1:1/none', // unreachable on purpose
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const queue: ServerMsg[] = [];
  const waiters: Array<() => void> = [];
  let buffer = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && msg.id !== null) {
          queue.push(msg);
          waiters.shift()?.();
        }
      } catch {
        /* ignore non-JSON output */
      }
    }
  });
  return {
    proc,
    send(msg) {
      proc.stdin?.write(JSON.stringify(msg) + '\n');
    },
    nextResponse() {
      return new Promise<ServerMsg>((resolve) => {
        const check = () => {
          const msg = queue.shift();
          if (msg) resolve(msg);
          else waiters.push(check);
        };
        check();
      });
    },
    close() {
      proc.kill('SIGKILL');
    },
  };
}

let server: Server | null = null;

afterAll(() => {
  server?.close();
});

function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!server) return reject(new Error('server not started'));
    server.send({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    });
    server
      .nextResponse()
      .then((msg) => {
        if (msg.error) return reject(new Error(msg.error.message));
        resolve(msg.result?.content?.[0]?.text ?? '');
      })
      .catch(reject);
  });
}

describe('admin-db MCP server: export_table (no DB needed)', () => {
  it('lists export_table as a tool', async () => {
    server = startServer();
    server.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const msg = await server.nextResponse();
    const tools = (msg.result?.tools ?? []) as Array<{ name: string }>;
    expect(tools.map((t) => t.name)).toContain('export_table');
  });

  it('rejects an invalid format', async () => {
    const text = await callTool('export_table', { table: 'products', format: 'pdf' });
    expect(text).toContain('Fehler:');
    expect(text).toContain('format');
  });

  it('rejects an invalid table name (SQL-injection attempt)', async () => {
    const text = await callTool('export_table', { table: 'products;DROP TABLE x' });
    expect(text).toContain('Fehler:');
    expect(text).toContain('Invalid');
  });

  it('rejects a table name with three parts', async () => {
    const text = await callTool('export_table', { table: 'a.b.c' });
    expect(text).toContain('Fehler:');
  });

  it('rejects a non-integer limit', async () => {
    const text = await callTool('export_table', { table: 'products', limit: 'many' });
    expect(text).toContain('Fehler:');
    expect(text).toContain('limit');
  });

  it('attempts a DB connection for valid args (fails with connection error)', async () => {
    const text = await callTool('export_table', {
      table: 'public.products',
      format: 'xlsx',
      limit: 5,
    });
    expect(text).toContain('Fehler:');
  });
});
