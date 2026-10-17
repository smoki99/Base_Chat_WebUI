/**
 * Centralized, validated environment access for the API.
 *
 * Previously `process.env` was read directly in several modules (index.ts,
 * app.ts, mcpClient.ts, …). This module is the single documented source of
 * truth: every env var the API understands is declared here with its default.
 *
 * Design: all access is lazy (getters) – the API must start with an
 * incomplete configuration (e.g. CHAT_PROVIDER unset on CI); missing values
 * degrade gracefully instead of crashing at import time.
 */
const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const listFromEnv = (name: string): string[] => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const optionalString = (name: string): string | undefined => {
  const raw = process.env[name];
  return raw !== undefined && raw.trim() !== '' ? raw.trim() : undefined;
};

export const env = {
  get NODE_ENV(): string {
    return process.env.NODE_ENV ?? 'development';
  },

  /** HTTP bind address. Default: loopback only (local-first project). */
  get HOST(): string {
    return process.env.HOST || '127.0.0.1';
  },

  get PORT(): number {
    return intFromEnv('PORT', 4001);
  },

  /** CORS – comma-separated allowed origins. Empty = allow all (dev). */
  get CORS_ORIGIN(): string[] {
    return listFromEnv('CORS_ORIGIN');
  },

  get CHAT_PROVIDER(): string {
    return process.env.CHAT_PROVIDER || 'mock';
  },

  get VOICE_SERVICE_URL(): string | undefined {
    return optionalString('VOICE_SERVICE_URL');
  },

  /** MCP server config file path (optional). */
  get MCP_CONFIG_FILE(): string | undefined {
    return optionalString('MCP_CONFIG_FILE');
  },

  /**
   * MCP server whitelist – comma-separated server names from the MCP config
   * (e.g. "sql"). Empty = all configured servers (legacy behavior).
   */
  get MCP_ENABLED_SERVERS(): string[] {
    return listFromEnv('MCP_ENABLED_SERVERS');
  },

  /** Timeout for MCP JSON-RPC requests in ms. Default: 30 s. */
  get MCP_REQUEST_TIMEOUT_MS(): number {
    return intFromEnv('MCP_REQUEST_TIMEOUT_MS', 30_000);
  },

  /**
   * PostgreSQL connection string (e.g. postgres://user:pass@host:5432/db).
   * Used by the admin table manager; unset = admin DB features disabled (503).
   */
  get DATABASE_URL(): string | undefined {
    return optionalString('DATABASE_URL');
  },

  /**
   * Shared secret for the /api/admin/* endpoints.
   * Unset = admin feature disabled (403).
   */
  get ADMIN_TOKEN(): string | undefined {
    return optionalString('ADMIN_TOKEN');
  },

  /**
   * Max rows per admin table export (CSV/XLSX). Default: 10000.
   * The per-request `limit` can only go lower, never above this cap.
   */
  get ADMIN_EXPORT_MAX_ROWS(): number {
    return intFromEnv('ADMIN_EXPORT_MAX_ROWS', 10_000);
  },
};
