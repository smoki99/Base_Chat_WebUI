import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { generateAdminToken } from '../middleware/adminAuth';
import { setPoolForTests, type PgQueryable } from '../services/pgPool';
import { parseTableName, AdminError } from '../services/adminService';

/** Build a fake pg pool that records calls and returns canned rows. */
function fakePool(overrides?: {
  tables?: unknown[];
  columns?: unknown[];
  rows?: unknown[];
  error?: Error;
}) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const pool: PgQueryable = {
    async query<T>(_text: string, values?: unknown[]) {
      calls.push({ text: _text, values });
      if (overrides?.error) throw overrides.error;
      if (/information_schema\.tables/.test(_text)) {
        // Apply the same system-schema filter the real SQL WHERE clause does.
        const rows = (overrides?.tables ?? []) as Array<Record<string, unknown>>;
        return {
          rows: rows.filter(
            (r) => !['pg_catalog', 'information_schema'].includes(String(r.table_schema))
          ) as T[],
        };
      }
      if (/information_schema\.columns/.test(_text)) {
        return { rows: (overrides?.columns ?? []) as T[] };
      }
      return { rows: (overrides?.rows ?? []) as T[] };
    },
  };
  return { pool, calls };
}

const TOKEN = generateAdminToken();

describe('admin API', () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = TOKEN;
    setPoolForTests(null);
  });

  it('403 when ADMIN_TOKEN is not configured', async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await request(app).get('/api/admin/tables');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('not configured');
  });

  it('403 with wrong token', async () => {
    const res = await request(app)
      .get('/api/admin/tables')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Invalid admin token');
  });

  it('503 with correct token but no DATABASE_URL', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const res = await request(app)
        .get('/api/admin/tables')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(503);
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });

  it('lists tables (public schema default)', async () => {
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    const { pool } = fakePool({
      tables: [
        { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE' },
        { table_schema: 'public', table_name: 'v_orders', table_type: 'VIEW' },
        { table_schema: 'pg_catalog', table_name: 'pg_class', table_type: 'BASE TABLE' },
      ],
    });
    setPoolForTests(pool);
    const res = await request(app).get('/api/admin/tables').set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { schema: 'public', table: 'users', kind: 'table' },
      { schema: 'public', table: 'v_orders', kind: 'view' },
    ]);
  });

  it('returns columns and rows in preview, clamping limit', async () => {
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    const { pool, calls } = fakePool({
      columns: [
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'text', is_nullable: 'YES' },
      ],
      rows: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'c' },
      ],
    });
    setPoolForTests(pool);
    const res = await request(app)
      .get('/api/admin/tables/users/preview?limit=1000')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.columns).toEqual([
      { name: 'id', dataType: 'integer', nullable: false },
      { name: 'name', dataType: 'text', nullable: true },
    ]);
    expect(res.body.data.rows).toHaveLength(3);
    expect(res.body.data.limit).toBe(200);
    // The SELECT used the clamped limit as $1
    const select = calls.find((c) => c.text.includes('SELECT *'));
    expect(select?.values).toEqual([201]);
  });

  it('404 for unknown table in preview', async () => {
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    setPoolForTests(fakePool({ columns: [] }).pool);
    const res = await request(app)
      .get('/api/admin/tables/nope/preview')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('not found');
  });

  it('400 for invalid identifiers', async () => {
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    setPoolForTests(fakePool({ columns: [] }).pool);
    for (const bad of ['a;b', 'a b', 'x"."y', 'a.b.c']) {
      const res = await request(app)
        .get(`/api/admin/tables/${encodeURIComponent(bad)}/preview`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(400);
    }
  });

  it('parseTableName defaults to public schema', () => {
    expect(parseTableName('users')).toEqual({ schema: 'public', table: 'users' });
    expect(parseTableName('s1.orders')).toEqual({ schema: 's1', table: 'orders' });
    expect(() => parseTableName('a.b.c')).toThrow(AdminError);
  });

  it('maps unexpected DB errors to 500', async () => {
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    setPoolForTests(fakePool({ error: new Error('connection refused') }).pool);
    const res = await request(app).get('/api/admin/tables').set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
  });
});
