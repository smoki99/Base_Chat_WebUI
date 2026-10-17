import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { setPoolForTests, type PgPoolLike } from '../services/pgPool';

const TOKEN = '11111111-2222-3333-4444-555555555555';

/** Registry row; TTL relative to "now" so tests never go stale. */
function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    token: TOKEN,
    table_schema: 'public',
    table_name: 'products',
    format: 'csv',
    row_limit: 10,
    created_at: new Date(Date.now() - 60_000),
    expires_at: new Date(Date.now() + 15 * 60_000),
    redeemed_at: null,
    ...overrides,
  };
}

const TABLE_ROWS = [
  { id: 1, name: 'Fischbrötchen' },
  { id: 2, name: 'Krabbenbrötchen' },
  { id: 3, name: 'Garnele' },
];

function fakePool(entryRows: unknown[], tableRows: unknown[] = TABLE_ROWS) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const make = {
    async query<T = unknown>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (/admin_exports WHERE token/.test(text)) return { rows: entryRows } as T;
      if (/information_schema\.columns/.test(text)) {
        return { rows: [{ column_name: 'id' }, { column_name: 'name' }] } as T;
      }
      if (/^SELECT \*/.test(text)) return { rows: tableRows } as T;
      return { rows: [] } as T;
    },
  };
  const client = { ...make, release: () => {} };
  const pool: PgPoolLike = { ...make, connect: async () => client };
  return { pool, calls };
}

describe('GET /api/admin/exports/:token (one-time chat export link)', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://fake@localhost:5432/test';
    setPoolForTests(null);
  });

  it('404 for an unknown token', async () => {
    const { pool } = fakePool([]);
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('not found');
  });

  it('404 for a malformed token (no DB lookup)', async () => {
    const { pool, calls } = fakePool([entryRow()]);
    setPoolForTests(pool);
    const res = await request(app).get('/api/admin/exports/not-a-uuid');
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('410 when the link was already redeemed', async () => {
    const { pool } = fakePool([entryRow({ redeemed_at: new Date(Date.now() - 1000) })]);
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${TOKEN}`);
    expect(res.status).toBe(410);
    expect(res.body.error.message).toContain('already used');
  });

  it('410 when the link expired', async () => {
    const { pool } = fakePool([
      entryRow({
        expires_at: new Date(Date.now() - 1000),
        created_at: new Date(Date.now() - 20 * 60_000),
      }),
    ]);
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${TOKEN}`);
    expect(res.status).toBe(410);
    expect(res.body.error.message).toContain('expired');
  });

  it('200: returns CSV, applies the row limit, marks the link redeemed', async () => {
    const { pool, calls } = fakePool([entryRow({ row_limit: 2 })]);
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe('attachment; filename="products.csv"');
    // UTF-8 BOM + header + data rows
    expect(res.text.startsWith('\ufeff')).toBe(true);
    expect(res.text).toContain('id,name');
    expect(res.text).toContain('Fischbrötchen');
    // limit applied (2 rows requested → SELECT ... LIMIT 3 for truncation check)
    const select = calls.find((c) => c.text.startsWith('SELECT *'));
    expect(select?.values?.[0]).toBe(3);
    // single use: UPDATE ... SET redeemed_at
    expect(calls.some((c) => /UPDATE public\.admin_exports/.test(c.text))).toBe(true);
  });

  it('200: XLSX format returns a binary workbook', async () => {
    const { pool } = fakePool([entryRow({ format: 'xlsx' })]);
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toBe('attachment; filename="products.xlsx"');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(100);
  });
});
