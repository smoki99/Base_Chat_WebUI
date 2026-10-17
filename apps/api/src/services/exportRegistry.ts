import { randomUUID } from 'node:crypto';
import { env } from '../env';
import { AdminError, parseTableName } from './adminService';
import { getPool, type PgQueryable } from './pgPool';

/**
 * One-time chat export links (Story-0035).
 *
 * The `admin-db` MCP server registers an export (table + format + limit) in
 * the shared Postgres table `public.admin_exports` and hands the chat a
 * one-time download URL. The API route `GET /api/admin/exports/:token`
 * validates the row (TTL + single use), generates the file on demand and
 * marks the row redeemed. No temp files, no cleanup job: expired rows are
 * purged opportunistically.
 *
 * NOTE: the MCP server (scripts/admin-db-mcp-server.mjs) duplicates the DDL
 * below because it cannot import TypeScript – keep both in sync.
 */

/** Link lifetime: 15 minutes, single use. */
export const EXPORT_TTL_MS = 15 * 60 * 1000;

type AdminExportFormat = 'csv' | 'xlsx';

export interface AdminExportEntry {
  token: string;
  schema: string;
  table: string;
  format: AdminExportFormat;
  limit: number;
  createdAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
}

const EXPORT_DDL = `
  CREATE TABLE IF NOT EXISTS public.admin_exports (
    token       UUID PRIMARY KEY,
    table_schema TEXT NOT NULL,
    table_name  TEXT NOT NULL,
    format      TEXT NOT NULL CHECK (format IN ('csv', 'xlsx')),
    row_limit   INTEGER NOT NULL CHECK (row_limit > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ
  )`;

function requirePool(pool: PgQueryable | null): PgQueryable {
  if (!pool) throw new AdminError(503, 'Database not configured (set DATABASE_URL)');
  return pool;
}

function parseToken(raw: string): string {
  // Token is a UUID – anything else is a 404 (do not leak which tokens exist).
  const t = raw.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    throw new AdminError(404, 'Export link not found');
  }
  return t.toLowerCase();
}

/**
 * Register a new one-time export. Validates table name, format and limit
 * with the same rules as the UI export (cap: ADMIN_EXPORT_MAX_ROWS).
 * Purges expired rows opportunistically.
 */
export async function createExportEntry(
  rawName: string,
  format: string,
  limit?: unknown,
  pool?: PgQueryable | null
): Promise<{ token: string; expiresAt: Date }> {
  const db = requirePool(pool ?? getPool());
  const fmt: AdminExportFormat | null = format === 'csv' || format === 'xlsx' ? format : null;
  if (!fmt) throw new AdminError(400, 'format must be "csv" or "xlsx"');

  const { schema, table } = parseTableName(rawName);

  const cap = Math.max(1, env.ADMIN_EXPORT_MAX_ROWS);
  const requested = Number(limit);
  const lim = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, cap) : cap;

  await db.query(EXPORT_DDL);
  await db.query('DELETE FROM public.admin_exports WHERE expires_at < now()');

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);
  await db.query(
    `INSERT INTO public.admin_exports
       (token, table_schema, table_name, format, row_limit, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, schema, table, fmt, lim, expiresAt]
  );
  return { token, expiresAt };
}

/** Fetch an export entry by token (404 for unknown/malformed tokens). */
export async function getExportEntry(
  token: string,
  pool?: PgQueryable | null
): Promise<AdminExportEntry> {
  const db = requirePool(pool ?? getPool());
  const t = parseToken(token);
  const res = await db.query<{
    token: string;
    table_schema: string;
    table_name: string;
    format: AdminExportFormat;
    row_limit: number;
    created_at: Date;
    expires_at: Date;
    redeemed_at: Date | null;
  }>(
    `SELECT token, table_schema, table_name, format, row_limit,
            created_at, expires_at, redeemed_at
       FROM public.admin_exports WHERE token = $1`,
    [t]
  );
  if (res.rows.length === 0) {
    throw new AdminError(404, 'Export link not found');
  }
  const r = res.rows[0]!;
  return {
    token: r.token,
    schema: r.table_schema,
    table: r.table_name,
    format: r.format,
    limit: r.row_limit,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
  };
}

/** Mark the entry as redeemed (single use). No-op if already redeemed. */
export async function markExportRedeemed(token: string, pool?: PgQueryable | null): Promise<void> {
  const db = requirePool(pool ?? getPool());
  await db.query(
    `UPDATE public.admin_exports
        SET redeemed_at = now()
      WHERE token = $1 AND redeemed_at IS NULL`,
    [parseToken(token)]
  );
}

/** Delete expired rows. */
export async function purgeExpiredExports(pool?: PgQueryable | null): Promise<void> {
  const db = requirePool(pool ?? getPool());
  await db.query('DELETE FROM public.admin_exports WHERE expires_at < now()');
}
