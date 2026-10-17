import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import type * as ExcelJS from 'exceljs';
import app from '../app';
import { generateAdminToken } from '../middleware/adminAuth';
import { setPoolForTests, type PgPoolLike } from '../services/pgPool';
import { buildCsv, csvCell, exportTable, AdminError } from '../services/adminService';

// exceljs ships as CJS – load via createRequire (same pattern as the service).
const { Workbook } = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');

const TOKEN = generateAdminToken();

interface FakeOpts {
  columns?: Array<{ column_name: string }>;
  rows?: Record<string, unknown>[];
  /** Record LIMIT values used by SELECT * (to assert cap enforcement). */
  recordLimits?: number[];
}

/** Fake pool answering the export queries (metadata + data). */
function fakePool(opts?: FakeOpts): { pool: PgPoolLike; opts: FakeOpts } {
  const options: FakeOpts = opts ?? {};
  const make = () => ({
    async query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }> {
      if (/information_schema\.columns/.test(text)) {
        return { rows: (options.columns ?? []) as T[] };
      }
      if (/SELECT \*/.test(text)) {
        const lim = Array.isArray(values) ? Number(values[0]) : NaN;
        if (options.recordLimits) options.recordLimits.push(lim);
        return {
          rows: (options.rows ?? []).slice(0, Number.isFinite(lim) ? lim : undefined) as T[],
        };
      }
      return { rows: [] as T[] };
    },
  });
  const client = { ...make(), release: () => {} };
  const pool: PgPoolLike = { ...make(), connect: async () => client };
  return { pool, opts: options };
}

const COLUMNS = [{ column_name: 'name' }, { column_name: 'note' }, { column_name: 'price' }];

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  delete process.env.ADMIN_EXPORT_MAX_ROWS;
  process.env.DATABASE_URL = 'postgres://x@localhost:5432/test';
  setPoolForTests(null);
});

afterEach(() => {
  setPoolForTests(null);
});

describe('csvCell / buildCsv (unit)', () => {
  it('escapes commas, quotes and line breaks per RFC 4180', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null/undefined empty, dates as ISO, objects as JSON', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(new Date('2025-01-02T03:04:05.000Z'))).toBe('2025-01-02T03:04:05.000Z');
    expect(csvCell({ a: 1 })).toBe('{"a":1}');
  });

  it('builds a document with UTF-8 BOM, header and CRLF breaks', () => {
    const buf = buildCsv(['a', 'b'], [{ a: 'x,y', b: null }]);
    expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(buf.toString('utf8')).toBe('\ufeffa,b\r\n"x,y",\r\n');
  });
});

describe('exportTable (service)', () => {
  it('throws 400 for an unknown format', async () => {
    await expect(exportTable('products', 'pdf', undefined, fakePool().pool)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('throws 400 for an invalid table name', async () => {
    await expect(exportTable('drop; --', 'csv', undefined, fakePool().pool)).rejects.toBeInstanceOf(
      AdminError
    );
  });

  it('throws 404 when the table does not exist', async () => {
    const { pool } = fakePool({ columns: [] });
    await expect(exportTable('ghost', 'csv', undefined, pool)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('truncates at the row cap and records it', async () => {
    process.env.ADMIN_EXPORT_MAX_ROWS = '2';
    const rows = [1, 2, 3, 4].map((i) => ({ name: `r${i}`, note: null, price: i }));
    const { pool } = fakePool({ columns: COLUMNS, rows });
    const file = await exportTable('products', 'csv', undefined, pool);
    expect(file.truncated).toBe(true);
    expect(file.rowsExported).toBe(2);
    expect(file.filename).toBe('products.csv');
    expect(file.contentType).toContain('text/csv');
  });

  it('honors a per-request limit below the cap', async () => {
    const rows = [1, 2, 3].map((i) => ({ name: `r${i}`, note: null, price: i }));
    const file = await exportTable(
      'products',
      'csv',
      '2',
      fakePool({ columns: COLUMNS, rows }).pool
    );
    expect(file.rowsExported).toBe(2);
  });

  it('never exceeds the env cap even with a large limit', async () => {
    process.env.ADMIN_EXPORT_MAX_ROWS = '2';
    const rows = [1, 2, 3, 4].map((i) => ({ name: `r${i}`, note: null, price: i }));
    const { pool, opts } = fakePool({ columns: COLUMNS, rows, recordLimits: [] });
    const file = await exportTable('products', 'csv', '1000', pool);
    expect(file.rowsExported).toBe(2);
    // The SQL LIMIT was cap+1 (the service fetches one extra row to detect truncation).
    expect(opts.recordLimits?.[0]).toBe(3);
  });
});

describe('GET /api/admin/tables/:name/export (route)', () => {
  const rows = [
    { name: 'Äpfel', note: 'mit, Komma', price: 1.5 },
    { name: 'Sag "Hallo"', note: null, price: 2 },
  ];

  /**
   * Download the export over a real HTTP server (supertest/superagent
   * mangles binary bodies into `{}`); returns status, headers and raw bytes.
   */
  async function getRaw(
    path: string,
    token: string | null = TOKEN
  ): Promise<{ status: number; headers: Headers; bytes: Buffer }> {
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('server address missing');
    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const bytes = Buffer.from(await res.arrayBuffer());
      return { status: res.status, headers: res.headers, bytes };
    } finally {
      server.close();
    }
  }

  it('downloads CSV with BOM, headers and escaping', async () => {
    setPoolForTests(fakePool({ columns: COLUMNS, rows }).pool);
    const { status, headers, bytes } = await getRaw('/api/admin/tables/products/export?format=csv');
    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('text/csv; charset=utf-8');
    expect(headers.get('content-disposition')).toBe('attachment; filename="products.csv"');
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = bytes.toString('utf8');
    expect(text).toContain('\ufeffname,note,price\r\n');
    expect(text).toContain('"mit, Komma"');
    expect(text).toContain('"Sag ""Hallo"""');
    expect(text).toContain('\r\n');
  });

  it('downloads XLSX that opens with exceljs (round-trip)', async () => {
    setPoolForTests(fakePool({ columns: COLUMNS, rows }).pool);
    const { status, headers, bytes } = await getRaw(
      '/api/admin/tables/products/export?format=xlsx'
    );
    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(headers.get('content-disposition')).toBe('attachment; filename="products.xlsx"');
    // XLSX is a ZIP: magic PK\x03\x04
    expect(Array.from(bytes.subarray(0, 2))).toEqual([0x50, 0x4b]);

    const wb = new Workbook();
    await wb.xlsx.load(bytes as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0]);
    const sheet = wb.worksheets[0];
    expect(sheet).toBeTruthy();
    const captured: unknown[][] = [];
    sheet?.eachRow((row) => {
      if (Array.isArray(row.values)) captured.push(row.values.slice(1));
    });
    expect(captured[0]).toEqual(['name', 'note', 'price']);
    expect(captured[1]?.[0]).toBe('Äpfel');
    expect(captured[1]?.[2]).toBe(1.5);
    expect(captured[2]?.[0]).toBe('Sag "Hallo"');
    expect(captured[2]?.[1]).toBeFalsy();
    expect(captured[2]?.[2]).toBe(2);
  });

  it('400 for an invalid format', async () => {
    setPoolForTests(fakePool({ columns: COLUMNS, rows }).pool);
    const res = await request(app)
      .get('/api/admin/tables/products/export?format=pdf')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('format');
  });

  it('404 for an unknown table', async () => {
    setPoolForTests(fakePool({ columns: [] }).pool);
    const res = await request(app)
      .get('/api/admin/tables/ghost/export?format=csv')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('403 without a token', async () => {
    setPoolForTests(fakePool({ columns: COLUMNS, rows }).pool);
    const res = await request(app).get('/api/admin/tables/products/export?format=csv');
    expect(res.status).toBe(403);
  });
});
