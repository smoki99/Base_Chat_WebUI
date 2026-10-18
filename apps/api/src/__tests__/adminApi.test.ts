import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { generateAdminToken } from '../middleware/adminAuth';
import { setPoolForTests, type PgPoolLike } from '../services/pgPool';
import { parseTableName, parseCsv, AdminError } from '../services/adminService';

interface FakeOpts {
  tables?: unknown[];
  columns?: unknown[];
  rows?: unknown[];
  /** Canned pg_constraint rows for relation lookups. */
  relations?: unknown[];
  /** Result of the "constraint already exists" check in createRelation. */
  relationExists?: boolean;
  /** Global error for every query. */
  error?: Error;
  /** Targeted error for queries matching `match`. */
  errorFor?: { match: RegExp; error: Error };
  /** Canned rows for column-existence checks, keyed by column name. */
  columnCheck?: Record<string, unknown[]>;
}

/** Build a fake pg pool (with connectable client) that records calls. */
function fakePool(opts?: FakeOpts) {
  const calls: Array<{ text: string; values?: unknown[]; via: 'pool' | 'client' }> = [];
  interface Answer {
    test: (text: string, values?: unknown[]) => boolean;
    rows?: unknown[];
    error?: Error;
  }
  const tableRows = (opts?.tables ?? []).filter(
    (r) =>
      !['pg_catalog', 'information_schema'].includes(
        String((r as Record<string, unknown>).table_schema)
      )
  );
  const answers: Answer[] = [
    ...(opts?.errorFor
      ? [{ test: (t: string) => opts.errorFor!.match.test(t), error: opts.errorFor.error }]
      : []),
    { test: (t) => /information_schema\.columns/.test(t), rows: opts?.columns },
    {
      test: (t) => /SELECT 1 AS x FROM pg_constraint/.test(t),
      rows: opts?.relationExists ? [{ x: 1 }] : [],
    },
    { test: (t) => /FROM pg_constraint/.test(t), rows: opts?.relations },
    { test: (t) => /information_schema\.tables/.test(t), rows: tableRows },
    { test: (t) => /SELECT \*/.test(t), rows: opts?.rows },
  ];
  const make = (via: 'pool' | 'client') => ({
    async query<T>(text: string, values?: unknown[]) {
      calls.push({ text, values, via });
      if (opts?.error) throw opts.error;
      // createRelation checks columns with 3 values; route by column name.
      if (
        /information_schema\.columns/.test(text) &&
        opts?.columnCheck &&
        Array.isArray(values) &&
        values.length === 3 &&
        typeof values[2] === 'string' &&
        values[2] in opts.columnCheck
      ) {
        return { rows: opts.columnCheck[values[2]!] as T[] };
      }
      for (const a of answers) {
        if (a.test(text, values)) {
          if (a.error) throw a.error;
          return { rows: (a.rows ?? []) as T[] };
        }
      }
      return { rows: [] as T[] };
    },
  });
  const client = { ...make('client'), release: () => {} };
  const pool: PgPoolLike = { ...make('pool'), connect: async () => client };
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

describe('admin API – Excel/CSV import', () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = TOKEN;
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    setPoolForTests(null);
  });

  it('201: creates table and inserts CSV rows in a transaction', async () => {
    const { pool, calls } = fakePool();
    setPoolForTests(pool);
    const csv = 'id,name,amount\n1,alice,12.5\n2,bob,7\n';
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'import_me')
      .attach('file', Buffer.from(csv), { filename: 'data.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      schema: 'public',
      table: 'import_me',
      rowsImported: 2,
    });
    expect(res.body.data.columns).toEqual([
      { name: 'id', dataType: 'integer', nullable: false },
      { name: 'name', dataType: 'text', nullable: false },
      { name: 'amount', dataType: 'double precision', nullable: false },
    ]);
    const texts = calls.map((c) => c.text);
    expect(texts).toContain('BEGIN');
    expect(texts).toContain('COMMIT');
    expect(texts).not.toContain('ROLLBACK');
    const create = calls.find((c) => c.text.includes('CREATE TABLE'));
    expect(create?.text).toContain('"id" integer NOT NULL');
    expect(create?.text).toContain('"amount" double precision NOT NULL');
    const insert = calls.find((c) => c.text.includes('INSERT INTO'));
    expect(insert?.text).toContain('"import_me"');
    expect(insert?.values).toEqual(['1', 'alice', '12.5', '2', 'bob', '7']);
    expect(calls.filter((c) => c.via === 'client').length).toBeGreaterThan(0);
  });

  it('infers types and nullability, deduplicates + fills empty headers', async () => {
    setPoolForTests(fakePool().pool);
    const csv = 'id,,id\n1,,\n2,y,9\n';
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 't')
      .attach('file', Buffer.from(csv), { filename: 'd.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.columns).toEqual([
      { name: 'id', dataType: 'integer', nullable: false },
      { name: 'column_2', dataType: 'text', nullable: true },
      { name: 'id_2', dataType: 'integer', nullable: true },
    ]);
  });

  it('201: infers bigint for integer values beyond the int4 range', async () => {
    const { pool, calls } = fakePool();
    setPoolForTests(pool);
    const csv =
      'BusinessPartnerID,SAPID,DealId\n' +
      '3108090487,51000000000012,101\n' +
      '3108090488,51000000000013,102\n';
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'business_partner')
      .attach('file', Buffer.from(csv), { filename: 'bp.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.columns).toEqual([
      { name: 'BusinessPartnerID', dataType: 'bigint', nullable: false },
      { name: 'SAPID', dataType: 'bigint', nullable: false },
      { name: 'DealId', dataType: 'integer', nullable: false },
    ]);
    const create = calls.find((c) => c.text.includes('CREATE TABLE'));
    expect(create?.text).toContain('"BusinessPartnerID" bigint NOT NULL');
    expect(create?.text).toContain('"SAPID" bigint NOT NULL');
    expect(create?.text).toContain('"DealId" integer NOT NULL');
  });

  it('201: infers bigint for negative values below the int4 range', async () => {
    setPoolForTests(fakePool().pool);
    const csv = 'n\n-3000000000\n-2\n';
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 't')
      .attach('file', Buffer.from(csv), { filename: 'd.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.columns).toEqual([{ name: 'n', dataType: 'bigint', nullable: false }]);
  });

  it('201: keeps a column as text when integer values exceed the int8 range', async () => {
    setPoolForTests(fakePool().pool);
    const csv = 'big\n123456789012345678901234567890\n999999999999999999999999999999\n';
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 't')
      .attach('file', Buffer.from(csv), { filename: 'd.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.columns).toEqual([{ name: 'big', dataType: 'text', nullable: false }]);
  });
  it('400 when no file field is attached', async () => {
    setPoolForTests(fakePool().pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'x');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('file');
  });

  it('400 for an empty file', async () => {
    setPoolForTests(fakePool().pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'x')
      .attach('file', Buffer.alloc(0), { filename: 'empty.csv', contentType: 'text/csv' });
    expect(res.status).toBe(400);
  });

  it('400 for a file with only a header row', async () => {
    setPoolForTests(fakePool().pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'x')
      .attach('file', Buffer.from('a,b\n'), { filename: 'h.csv', contentType: 'text/csv' });
    expect(res.status).toBe(400);
  });

  it('sanitizes the table name (spaces/dashes → underscores)', async () => {
    const { pool, calls } = fakePool();
    setPoolForTests(pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'My Data-2024')
      .attach('file', Buffer.from('a\n1\n'), { filename: 'd.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.table).toBe('My_Data_2024');
    expect(calls.some((c) => c.text.includes('CREATE TABLE public."My_Data_2024"'))).toBe(true);
  });

  it('derives the table name from the filename when no table field is given', async () => {
    setPoolForTests(fakePool().pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', Buffer.from('a\n1\n'), {
        filename: 'my report.xlsx',
        contentType: 'application/octet-stream',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.table).toBe('my_report');
  });

  it('maps 42809 (table already exists) to 409', async () => {
    setPoolForTests(
      fakePool({
        errorFor: {
          match: /CREATE TABLE/,
          error: Object.assign(new Error('duplicate'), { code: '42809' }),
        },
      }).pool
    );
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'x')
      .attach('file', Buffer.from('a\n1\n'), { filename: 'd.csv', contentType: 'text/csv' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already exists');
  });

  it('rolls back (and releases) when an INSERT fails', async () => {
    const { pool, calls } = fakePool({
      errorFor: { match: /INSERT INTO/, error: new Error('boom') },
    });
    setPoolForTests(pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'x')
      .attach('file', Buffer.from('a\n1\n'), { filename: 'd.csv', contentType: 'text/csv' });
    expect(res.status).toBe(500);
    const texts = calls.map((c) => c.text);
    expect(texts).toContain('BEGIN');
    expect(texts).toContain('ROLLBACK');
    expect(texts).not.toContain('COMMIT');
  });

  it('201: parses a real XLSX upload end-to-end', async () => {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    const sheet = wb.addWorksheet('data');
    sheet.addRow(['id', 'note']);
    sheet.addRow([1, 'x']);
    sheet.addRow([2, null]);
    const buffer = await wb.xlsx.writeBuffer();
    setPoolForTests(fakePool().pool);
    const res = await request(app)
      .post('/api/admin/tables/import')
      .set('Authorization', `Bearer ${TOKEN}`)
      .field('table', 'from_xlsx')
      .attach('file', Buffer.from(buffer), {
        filename: 'sheet.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.rowsImported).toBe(2);
    expect(res.body.data.columns).toEqual([
      { name: 'id', dataType: 'integer', nullable: false },
      { name: 'note', dataType: 'text', nullable: true },
    ]);
  });
});

describe('admin API – delete table', () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = TOKEN;
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    setPoolForTests(null);
  });

  it('200 for an existing base table', async () => {
    const { pool, calls } = fakePool({ tables: [{ table_type: 'BASE TABLE' }] });
    setPoolForTests(pool);
    const res = await request(app)
      .delete('/api/admin/tables/users')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ schema: 'public', table: 'users' });
    expect(calls.some((c) => c.text.includes('DROP TABLE "public"."users"'))).toBe(true);
  });

  it('404 when the table does not exist', async () => {
    setPoolForTests(fakePool({ tables: [] }).pool);
    const res = await request(app)
      .delete('/api/admin/tables/nope')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('400 for views', async () => {
    setPoolForTests(fakePool({ tables: [{ table_type: 'VIEW' }] }).pool);
    const res = await request(app)
      .delete('/api/admin/tables/v_orders')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it('409 when dependent objects exist (2BP01)', async () => {
    setPoolForTests(
      fakePool({
        tables: [{ table_type: 'BASE TABLE' }],
        errorFor: {
          match: /DROP TABLE/,
          error: Object.assign(new Error('dep'), { code: '2BP01' }),
        },
      }).pool
    );
    const res = await request(app)
      .delete('/api/admin/tables/users')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('dependent');
  });
});

describe('admin API – relations', () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = TOKEN;
    process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
    setPoolForTests(null);
  });

  const relation = {
    constraint: 'orders_customer_id_fkey',
    source_schema: 'public',
    source_table: 'orders',
    source_column: 'customer_id',
    target_schema: 'public',
    target_table: 'customers',
    target_column: 'id',
  };

  it('200: lists foreign-key relations', async () => {
    setPoolForTests(fakePool({ relations: [relation] }).pool);
    const res = await request(app)
      .get('/api/admin/relations')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        constraint: 'orders_customer_id_fkey',
        sourceSchema: 'public',
        sourceTable: 'orders',
        sourceColumn: 'customer_id',
        targetSchema: 'public',
        targetTable: 'customers',
        targetColumn: 'id',
      },
    ]);
  });

  it('201: creates a relation with the derived constraint name', async () => {
    const { pool, calls } = fakePool({
      columns: [{ column_name: 'customer_id' }],
      relationExists: false,
    });
    setPoolForTests(pool);
    const res = await request(app)
      .post('/api/admin/relations')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        sourceTable: 'orders',
        sourceColumn: 'customer_id',
        targetTable: 'customers',
        targetColumn: 'id',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.constraint).toBe('orders_customer_id_fkey');
    const alter = calls.find((c) => c.text.includes('ADD CONSTRAINT'));
    expect(alter?.text).toContain('ALTER TABLE "public"."orders"');
    expect(alter?.text).toContain('FOREIGN KEY ("customer_id")');
    expect(alter?.text).toContain('REFERENCES "public"."customers" ("id")');
  });

  it('400 when a column is missing', async () => {
    setPoolForTests(fakePool({ columns: [] }).pool);
    const res = await request(app)
      .post('/api/admin/relations')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        sourceTable: 'orders',
        sourceColumn: 'nope',
        targetTable: 'customers',
        targetColumn: 'id',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('not found');
  });

  it('400 when the target column is missing', async () => {
    setPoolForTests(
      fakePool({
        columnCheck: {
          customer_id: [{ column_name: 'customer_id' }],
          ghost: [],
        },
      }).pool
    );
    const res = await request(app)
      .post('/api/admin/relations')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        sourceTable: 'orders',
        sourceColumn: 'customer_id',
        targetTable: 'customers',
        targetColumn: 'ghost',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('customers');
  });

  it('409 when the constraint already exists', async () => {
    setPoolForTests(fakePool({ columns: [{ column_name: 'x' }], relationExists: true }).pool);
    const res = await request(app)
      .post('/api/admin/relations')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        sourceTable: 'orders',
        sourceColumn: 'customer_id',
        targetTable: 'customers',
        targetColumn: 'id',
      });
    expect(res.status).toBe(409);
  });

  it('400 for a malformed payload', async () => {
    setPoolForTests(fakePool().pool);
    const res = await request(app)
      .post('/api/admin/relations')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ sourceTable: 'orders' });
    expect(res.status).toBe(400);
  });

  it('200: deletes a relation by constraint name', async () => {
    const { pool, calls } = fakePool({ relations: [relation] });
    setPoolForTests(pool);
    const res = await request(app)
      .delete('/api/admin/relations/orders_customer_id_fkey')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.constraint).toBe('orders_customer_id_fkey');
    expect(calls.some((c) => c.text.includes('DROP CONSTRAINT'))).toBe(true);
  });

  it('404 for an unknown constraint', async () => {
    setPoolForTests(fakePool({ relations: [] }).pool);
    const res = await request(app)
      .delete('/api/admin/relations/ghost_fkey')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });
});

describe('csv parser', () => {
  it('handles quotes, escaped quotes, CRLF and trailing newlines', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\r\n"x","y""z"\r\n')).toEqual([
      ['a', 'b'],
      ['x', 'y"z'],
    ]);
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('')).toEqual([]);
  });

  it('rejects invalid identifiers in parseTableName', () => {
    expect(() => parseTableName('a;b')).toThrow(AdminError);
  });
});
