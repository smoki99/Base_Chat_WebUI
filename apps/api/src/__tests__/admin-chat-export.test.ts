import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { generateAdminToken } from '../middleware/adminAuth';
import { setPoolForTests, type PgPoolLike } from '../services/pgPool';
import { EXPORT_TTL_MS } from '../services/exportRegistry';

const TOKEN = generateAdminToken();
const EXPORT_TOKEN = '11111111-2222-3333-4444-555555555555';

interface EntryRow {
  token: string;
  table_schema: string;
  table_name: string;
  format: string;
  row_limit: number;
  created_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
}

interface FakeOpts {
  entry?: EntryRow | null;
  columns?: Array<{ column_name: string }>;
  rows?: Record<string, unknown>[];
}

function entryRow(over: Partial<EntryRow> = {}): EntryRow {
  return {
    token: EXPORT_TOKEN,
    table_schema: 'public',
    table_name: 'products',
    format: 'csv',
    row_limit: 50,
    created_at: new Date(Date.now() - 1000),
    expires_at: new Date(Date.now() + EXPORT_TTL_MS),
    redeemed_at: null,
    ...over,
  };
}

function fakePool(opts?: FakeOpts) {
  const options: FakeOpts = opts ?? {};
  const calls: string[] = [];
  const make = () => ({
    async query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }> {
      calls.push(text);
      if (/CREATE TABLE IF NOT EXISTS public\.admin_exports/.test(text)) return { rows: [] as T[] };
      if (/DELETE FROM public\.admin_exports/.test(text)) return { rows: [] as T[] };
      if (/SELECT token, table_schema/.test(text)) {
        return { rows: (options.entry ? [options.entry] : []) as T[] };
      }
      if (/information_schema\.columns/.test(text)) {
        return { rows: (options.columns ?? []) as T[] };
      }
      if (/SELECT \*/.test(text)) {
        const lim = Array.isArray(values) ? Number(values[0]) : undefined;
        return { rows: (options.rows ?? []).slice(0, lim) as T[] };
      }
      if (/UPDATE public\.admin_exports/.test(text)) return { rows: [] as T[] };
      return { rows: [] as T[] };
    },
  });
  const client = { ...make(), release: () => {} };
  const pool: PgPoolLike = { ...make(), connect: async () => client };
  return { pool, calls };
}

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
  delete process.env.ADMIN_EXPORT_MAX_ROWS;
  setPoolForTests(null);
});

afterEach(() => {
  setPoolForTests(null);
});

/** Download over a real server (supertest mangles binary bodies). */
async function getRaw(path: string): Promise<{ status: number; headers: Headers; bytes: Buffer }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('server address missing');
  try {
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`);
    return {
      status: res.status,
      headers: res.headers,
      bytes: Buffer.from(await res.arrayBuffer()),
    };
  } finally {
    server.close();
  }
}

describe('GET /api/admin/exports/:token (chat export link)', () => {
  it('404 for an unknown token', async () => {
    const { pool } = fakePool({ entry: null });
    setPoolForTests(pool);
    const res = await request(app).get('/api/admin/exports/99999999-8888-7777-6666-555555555555');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('not found');
  });

  it('404 for a malformed token without touching the DB', async () => {
    const { pool, calls } = fakePool();
    setPoolForTests(pool);
    const res = await request(app).get('/api/admin/exports/not-a-token');
    expect(res.status).toBe(404);
    expect(calls.filter((t) => t.includes('SELECT token'))).toHaveLength(0);
  });

  it('410 when the link was already used', async () => {
    const { pool, calls } = fakePool({ entry: entryRow({ redeemed_at: new Date() }) });
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${EXPORT_TOKEN}`);
    expect(res.status).toBe(410);
    expect(res.body.error.message).toContain('already used');
    expect(calls.filter((t) => t.includes('SELECT *'))).toHaveLength(0);
  });

  it('410 when the link expired', async () => {
    const { pool, calls } = fakePool({
      entry: entryRow({ expires_at: new Date(Date.now() - 60_000) }),
    });
    setPoolForTests(pool);
    const res = await request(app).get(`/api/admin/exports/${EXPORT_TOKEN}`);
    expect(res.status).toBe(410);
    expect(res.body.error.message).toContain('expired');
    expect(calls.filter((t) => t.includes('SELECT *'))).toHaveLength(0);
  });

  it('200: streams the CSV without Bearer auth and marks the link redeemed', async () => {
    const { pool, calls } = fakePool({
      entry: entryRow(),
      columns: [{ column_name: 'name' }, { column_name: 'price' }],
      rows: [
        { name: 'Apfel', price: 1.5 },
        { name: 'Birne', price: 2 },
      ],
    });
    setPoolForTests(pool);
    const { status, headers, bytes } = await getRaw(`/api/admin/exports/${EXPORT_TOKEN}`);
    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('text/csv; charset=utf-8');
    expect(headers.get('content-disposition')).toBe('attachment; filename="products.csv"');
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(bytes.toString('utf8')).toContain('Apfel,1.5');
    expect(calls.filter((t) => t.includes('UPDATE public.admin_exports'))).toHaveLength(1);
  });

  it('200: streams a valid XLSX for an xlsx entry', async () => {
    const { pool } = fakePool({
      entry: entryRow({ format: 'xlsx', table_name: 'orders' }),
      columns: [{ column_name: 'id' }, { column_name: 'total' }],
      rows: [
        { id: 1, total: 99.9 },
        { id: 2, total: 5 },
      ],
    });
    setPoolForTests(pool);
    const { status, headers, bytes } = await getRaw(`/api/admin/exports/${EXPORT_TOKEN}`);
    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('spreadsheetml');
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04])); // ZIP magic
  });
});

describe('registry limit enforcement', () => {
  it('uses the row limit stored in the registry (cap + 1 for truncation check)', async () => {
    const limits: number[] = [];
    const opts: FakeOpts = {
      entry: entryRow({ row_limit: 1 }),
      columns: [{ column_name: 'name' }],
      rows: [{ name: 'a' }, { name: 'b' }],
    };
    const make = () => ({
      async query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }> {
        if (/SELECT token, table_schema/.test(text)) return { rows: [opts.entry!] as T[] };
        if (/information_schema\.columns/.test(text)) return { rows: (opts.columns ?? []) as T[] };
        if (/SELECT \*/.test(text)) {
          const lim = Array.isArray(values) ? Number(values[0]) : undefined;
          if (lim !== undefined && Number.isFinite(lim)) limits.push(lim);
          return { rows: (opts.rows ?? []).slice(0, lim) as T[] };
        }
        return { rows: [] as T[] };
      },
    });
    const client = { ...make(), release: () => {} };
    setPoolForTests({ ...make(), connect: async () => client });
    const { status, bytes } = await getRaw(`/api/admin/exports/${EXPORT_TOKEN}`);
    expect(status).toBe(200);
    expect(limits).toContain(2); // limit 1 + 1 (truncation detection)
    expect(bytes.toString('utf8').split('\r\n')).toHaveLength(3); // header + 1 row + trailing
  });
});
