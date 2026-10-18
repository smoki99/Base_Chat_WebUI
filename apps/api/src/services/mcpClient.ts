/**
 * Minimal MCP (Model Context Protocol) client – no external dependencies.
 * Implements the MCP JSON-RPC 2.0 protocol over stdio:
 *   - Spawns the server process
 *   - `initialize` handshake
 *   - `tools/list` to discover available tools
 *   - `tools/call` to execute tools
 *
 * Reference: https://modelcontextprotocol.io/specification
 */
import { spawn } from 'node:child_process';
import { env } from '../env';
import type { ToolDefinition, ToolHandler } from '../types/chat';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Working directory for the spawned process (set by loadMcpConfig to the config file's dir). */
  cwd?: string;
}

interface McpConnection {
  serverName: string;
  tools: ToolDefinition[];
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): void;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Connect to an MCP server via stdio and return an active connection.
 * Resolves once the `initialize` handshake is complete.
 */
async function connectMcpServer(config: McpServerConfig): Promise<McpConnection> {
  // Per-connection request-id counter. (Regression: a module-level counter
  // was shared between connections – one server's timed-out request could
  // reject another server's pending response with the same id.)
  let nextId = 1;

  const child = spawn(config.command, config.args ?? [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    // config.env = per-server additions (e.g. DATABASE_URL) on top of the
    // API's own environment.
    env: { ...process.env, ...config.env },
    // cwd = config file's directory so relative script paths (e.g.
    // "scripts/sql-mcp-server.mjs") resolve correctly in both dev (cwd=apps/api)
    // and the container (cwd=/app, config at /app/apps/api/mcp-config.json).
    cwd: config.cwd ?? process.cwd(),
  });

  let stdoutBuf = '';
  const pending = new Map<
    number,
    { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }
  >();

  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    let newlineIdx: number;
    while ((newlineIdx = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, newlineIdx).trim();
      stdoutBuf = stdoutBuf.slice(newlineIdx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)!.resolve(msg);
          pending.delete(msg.id);
        }
      } catch {
        // Ignore malformed lines.
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) console.warn(`[mcp:${config.name}]`, text);
  });

  // If the child process exits, reject all pending requests immediately.
  child.on('exit', (code) => {
    pending.forEach((p) => p.reject(new Error(`MCP server exited (code ${code})`)));
    pending.clear();
  });

  function sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = nextId++;
    const payload: JsonRpcRequest = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin?.write(JSON.stringify(payload) + '\n');
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`MCP request timed out: ${method} (server: ${config.name})`));
        }
      }, env.MCP_REQUEST_TIMEOUT_MS);
    }).then((res) => {
      if (res.error) throw new Error(`MCP error ${res.error.code}: ${res.error.message}`);
      return res.result;
    });
  }

  function sendNotification(method: string, params?: Record<string, unknown>): void {
    const payload = { jsonrpc: '2.0' as const, method, ...(params ? { params } : {}) };
    child.stdin?.write(JSON.stringify(payload) + '\n');
  }

  // 1. Initialize handshake.
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'base-chat-webui', version: '1.0.0' },
  });

  // 2. Send initialized notification.
  sendNotification('notifications/initialized');

  // 3. List tools.
  const listResult = (await sendRequest('tools/list')) as {
    tools?: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
  };

  const tools: ToolDefinition[] = (listResult?.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema ?? {},
  }));

  return {
    serverName: config.name,
    tools,
    async callTool(name: string, args: Record<string, unknown>): Promise<string> {
      const result = (await sendRequest('tools/call', { name, arguments: args })) as {
        content?: Array<{ type: string; text?: string; resource?: { text?: string } }>;
      };
      const text = result?.content?.map((c) => c.text ?? c.resource?.text ?? '').join('\n') ?? '';
      console.log(
        `[mcp] callTool(${name}) → ${text.length} chars | raw: ${JSON.stringify(result)?.slice(0, 300)}`
      );
      return text || '(no output)';
    },
    close: () => {
      pending.forEach((p) => p.reject(new Error('MCP connection closed')));
      pending.clear();
      child.kill();
    },
  };
}

// ── Config loading & multi-server orchestration ─────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface McpContext {
  connections: McpConnection[];
  allTools: ToolDefinition[];
  toolHandlers: Map<string, ToolHandler>;
  closeAll(): void;
}

export function loadMcpConfig(configPath?: string): McpServerConfig[] {
  const path = configPath ?? env.MCP_CONFIG_FILE ?? resolve(process.cwd(), 'mcp-config.json');
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as { servers?: McpServerConfig[] };
    let servers = raw.servers ?? [];
    // Whitelist (MCP_ENABLED_SERVERS): only explicitly enabled servers are
    // spawned – unknown entries in the config file stay inert.
    const whitelist = env.MCP_ENABLED_SERVERS;
    if (whitelist.length > 0) {
      const skipped = servers.filter((s) => !whitelist.includes(s.name)).map((s) => s.name);
      servers = servers.filter((s) => whitelist.includes(s.name));
      if (skipped.length > 0) {
        console.warn(
          `[mcp] Skipping disabled server(s): ${skipped.join(', ')} (MCP_ENABLED_SERVERS whitelist)`
        );
      }
    }
    // Resolve relative script paths against the config file's directory so
    // they work regardless of process.cwd() (dev: apps/api, container: /app).
    const baseDir = dirname(resolve(path));
    return servers.map((s) => ({ ...s, cwd: s.cwd ?? baseDir }));
  } catch (err) {
    console.error(`[mcp] Failed to parse ${path}:`, err);
    return [];
  }
}

/**
 * Sanitize tool arguments before forwarding to the MCP server.
 * LLMs sometimes include score percentages or file IDs in qmd.multi_get patterns.
 */
export function sanitizeToolArgs(
  qualifiedName: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  if (qualifiedName === 'qmd.multi_get' && typeof args.pattern === 'string') {
    let p = args.pattern as string;
    // Iteratively strip leading score/ID tokens (handles both "#id 74% path" and "74% #id path").
    let changed = true;
    while (changed) {
      changed = false;
      const noScore = p.replace(/^\d+%\s*/, '');
      if (noScore !== p) {
        p = noScore;
        changed = true;
      }
      const noId = p.replace(/^#[\da-f]+\s*/i, '');
      if (noId !== p) {
        p = noId;
        changed = true;
      }
    }
    // Strip qmd:// prefix
    p = p.replace(/^qmd:\/\//, '');
    // Strip trailing :lineNumber (e.g. "knowhow/file.md:42")
    p = p.replace(/:\d+$/, '');
    return { ...args, pattern: p };
  }
  return args;
}

export async function connectAllMcpServers(configs: McpServerConfig[]): Promise<McpContext> {
  const connections: McpConnection[] = [];
  const allTools: ToolDefinition[] = [];
  const toolHandlers = new Map<string, ToolHandler>();

  for (const config of configs) {
    try {
      const conn = await connectMcpServer(config);
      connections.push(conn);
      for (const tool of conn.tools) {
        const qualifiedName = `${config.name}.${tool.name}`;
        allTools.push({
          name: qualifiedName,
          description: `[${config.name}] ${tool.description}`,
          parameters: tool.parameters,
        });
        toolHandlers.set(qualifiedName, async (args) =>
          conn.callTool(tool.name, sanitizeToolArgs(qualifiedName, args))
        );
      }
      console.log(`[mcp] Connected to "${config.name}" (${conn.tools.length} tools)`);
    } catch (err) {
      console.warn(`[mcp] Failed to connect to "${config.name}":`, err);
    }
  }

  return {
    connections,
    allTools,
    toolHandlers,
    closeAll: () => connections.forEach((c) => c.close()),
  };
}
