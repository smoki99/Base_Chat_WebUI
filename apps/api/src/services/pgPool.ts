import { Pool } from 'pg';
import type { QueryResultRow } from 'pg';
import { env } from '../env';

/**
 * Lazy Postgres pool for the admin table manager.
 *
 * The pool is created on first use (not at import time) so the API can start
 * without a configured DATABASE_URL. When unset, `getPool()` returns null and
 * admin DB routes answer 503.
 */
let pool: Pool | null = null;

/** Minimal query interface the admin service relies on (easier to fake in tests). */
export interface PgQueryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[] }>;
}

/** A dedicated connection (used for multi-statement transactions). */
export interface PgClient extends PgQueryable {
  release(): void;
}

/** Pool interface: ad-hoc queries + a connectable client for transactions. */
export interface PgPoolLike extends PgQueryable {
  connect(): Promise<PgClient>;
}

export function getPool(): PgPoolLike | null {
  if (!env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  return pool;
}

/** Test helper: inject a fake pool (or null to reset to lazy creation). */
export function setPoolForTests(p: PgPoolLike | null): void {
  pool = p as Pool | null;
}

/** Graceful shutdown: end the pool if one was created. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
