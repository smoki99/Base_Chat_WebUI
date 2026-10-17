import { describe, it, expect, beforeEach } from 'vitest';
import type { PgPoolLike } from '../services/pgPool';
import {
  EXPORT_TTL_MS,
  createExportEntry,
  getExportEntry,
  markExportRedeemed,
  purgeExpiredExports,
} from '../services/exportRegistry';
import { AdminError } from '../services/adminService';

interface FakePool {
  pool: PgPoolLike;
  calls: Array<{ text: string; values?: unknown[] }>;
}

function fakePool(
  rowsFor = (text: string): unknown[] => {
    if (/SELECT token/.test(text)) {
      return [
        {
          token: '11111111-2222-3333-4444-555555555555',
          table_schema: 'public',
          table_name: 'products',
          format: 'csv',
          row_limit: 42,
          created_at: new Date('2026-02-21T00:00:00Z'),
          expires_at: new Date('2026-02-21T00:15:00Z'),
          redeemed_at: null,
        },
      ];
    }
    return [];
  }
): FakePool {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const make = {
    async query<T>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows: rowsFor(text) as T[] };
    },
  };
  const pool: PgPoolLike = { ...make, connect: async () => ({ ...make, release: () => {} }) };
  return { pool, calls };
}

describe('exportRegistry', () => {
  beforeEach(() => {
    delete process.env.ADMIN_EXPORT_MAX_ROWS;
  });

  describe('createExportEntry', () => {
    it('creates a UUID token with a 15 minute TTL', async () => {
      const { pool, calls } = fakePool();
      const before = Date.now();
      const { token, expiresAt } = await createExportEntry('products', 'csv', undefined, pool);
      expect(token).toMatch(/^[0-9a-f-]{36}$/);
      expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(EXPORT_TTL_MS - 5_000);
      expect(expiresAt.getTime() - before).toBeLessThanOrEqual(EXPORT_TTL_MS + 5_000);

      const ddl = calls.find((c) =>
        c.text.includes('CREATE TABLE IF NOT EXISTS public.admin_exports')
      );
      expect(ddl).toBeDefined();
      const insert = calls.find((c) => c.text.includes('INSERT INTO public.admin_exports'));
      expect(insert).toBeDefined();
      expect(insert?.values).toEqual([token, 'public', 'products', 'csv', 10000, expiresAt]);
    });

    it('purges expired rows while creating', async () => {
      const { pool, calls } = fakePool();
      await createExportEntry('products', 'xlsx', undefined, pool);
      expect(calls.some((c) => c.text.includes('DELETE FROM public.admin_exports'))).toBe(true);
    });

    it('400 for an invalid format', async () => {
      const { pool } = fakePool();
      await expect(createExportEntry('products', 'pdf', undefined, pool)).rejects.toThrow(
        AdminError
      );
    });

    it('400 for an invalid table name', async () => {
      const { pool } = fakePool();
      await expect(createExportEntry('products;drop', 'csv', undefined, pool)).rejects.toThrow(
        AdminError
      );
    });

    it('clamps limit to ADMIN_EXPORT_MAX_ROWS', async () => {
      process.env.ADMIN_EXPORT_MAX_ROWS = '100';
      const { pool, calls } = fakePool();
      await createExportEntry('public.products', 'csv', 5000, pool);
      const insert = calls.find((c) => c.text.includes('INSERT INTO public.admin_exports'));
      expect(insert?.values?.[4]).toBe(100);
    });

    it('defaults limit to the cap and keeps explicit lower limits', async () => {
      process.env.ADMIN_EXPORT_MAX_ROWS = '100';
      const { pool, calls } = fakePool();
      await createExportEntry('products', 'csv', 7, pool);
      const insert = calls.find((c) => c.text.includes('INSERT INTO public.admin_exports'));
      expect(insert?.values?.[4]).toBe(7);
    });
  });

  describe('getExportEntry', () => {
    it('maps the row to an entry', async () => {
      const { pool } = fakePool();
      const entry = await getExportEntry('11111111-2222-3333-4444-555555555555', pool);
      expect(entry).toMatchObject({
        schema: 'public',
        table: 'products',
        format: 'csv',
        limit: 42,
        redeemedAt: null,
      });
      expect(entry.expiresAt.toISOString()).toBe('2026-02-21T00:15:00.000Z');
    });

    it('404 for an unknown token', async () => {
      const { pool } = fakePool(() => []);
      await expect(getExportEntry('99999999-8888-7777-6666-555555555555', pool)).rejects.toThrow(
        AdminError
      );
    });

    it('404 for a malformed token without hitting the DB', async () => {
      const { pool, calls } = fakePool();
      await expect(getExportEntry('not-a-uuid', pool)).rejects.toThrow(AdminError);
      expect(calls).toHaveLength(0);
    });
  });

  describe('markExportRedeemed', () => {
    it('marks the row redeemed exactly once', async () => {
      const { pool, calls } = fakePool();
      await markExportRedeemed('11111111-2222-3333-4444-555555555555', pool);
      const update = calls.find((c) => c.text.includes('UPDATE public.admin_exports'));
      expect(update?.text).toContain('redeemed_at IS NULL');
      expect(update?.values).toEqual(['11111111-2222-3333-4444-555555555555']);
    });
  });

  describe('purgeExpiredExports', () => {
    it('deletes expired rows', async () => {
      const { pool, calls } = fakePool();
      await purgeExpiredExports(pool);
      expect(calls[0]?.text).toContain('DELETE FROM public.admin_exports WHERE expires_at < now()');
    });
  });
});
