import { Workbook } from 'exceljs';
import type {
  AdminImportResult,
  AdminRelation,
  AdminRelationCreate,
  AdminTable,
  AdminTableDeleted,
  AdminTablePreview,
} from 'shared';
import { getPool, type PgClient, type PgPoolLike, type PgQueryable } from './pgPool';

/**
 * Read-only Postgres table listing + preview for the admin UI.
 *
 * All user input (schema/table names) is validated against Postgres'
 * unquoted-identifier grammar and the queries use parameterized metadata
 * lookups; `SELECT *` uses quoted identifiers built from the validated
 * names only.
 */

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/** Error with an HTTP status and a message safe to expose to the client. */
export class AdminError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

/** Parse "table" or "schema.table" into validated identifier parts. */
export function parseTableName(raw: string): { schema: string; table: string } {
  const check = (name: string) => {
    if (!IDENTIFIER.test(name)) throw new AdminError(400, `Invalid identifier "${name}"`);
    return name;
  };
  const parts = raw.split('.');
  if (parts.length === 1) {
    return { schema: 'public', table: check(parts[0]!) };
  }
  if (parts.length === 2) {
    return { schema: check(parts[0]!), table: check(parts[1]!) };
  }
  throw new AdminError(400, 'Expected "table" or "schema.table"');
}

const clampLimit = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 50;
  return Math.min(n, 200);
};

function requirePool(pool: PgQueryable | null): PgQueryable {
  if (!pool) throw new AdminError(503, 'Database not configured (set DATABASE_URL)');
  return pool;
}

/** List all base tables and views outside system schemas. */
export async function listTables(pool?: PgQueryable): Promise<AdminTable[]> {
  const db = requirePool(pool ?? getPool());
  const result = await db.query<{ table_schema: string; table_name: string; table_type: string }>(
    `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_schema, table_name`
  );
  return result.rows.map((r) => ({
    schema: r.table_schema,
    table: r.table_name,
    kind: r.table_type === 'VIEW' ? 'view' : 'table',
  }));
}

/** Preview columns + first rows of a table (limit clamped to 1..200). */
export async function previewTable(
  rawName: string,
  limit: unknown,
  pool?: PgQueryable
): Promise<AdminTablePreview> {
  const db = requirePool(pool ?? getPool());
  const { schema, table } = parseTableName(rawName);
  const lim = clampLimit(limit);

  const [colRes, rowRes] = await Promise.all([
    db
      .query<{ column_name: string; data_type: string; is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position`,
        [schema, table]
      )
      .then((r) => r.rows),
    db.query<Record<string, unknown>>(`SELECT * FROM "${schema}"."${table}" LIMIT $1`, [lim + 1]),
  ]);

  if (colRes.length === 0) {
    throw new AdminError(404, `Table "${schema}.${table}" not found`);
  }

  const rows = rowRes.rows.slice(0, lim);
  return {
    schema,
    table,
    columns: colRes.map((c) => ({
      name: c.column_name,
      dataType: c.data_type,
      nullable: c.is_nullable === 'YES',
    })),
    rows,
    hasMore: rowRes.rows.length > lim,
    limit: lim,
  };
}

// ── Import (Excel/CSV → new table) ───────────────────────────────────────────

interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

/** Sanitize a user-supplied table name for CREATE TABLE. */
function sanitizeTableName(raw: string): string {
  let name = raw.replace(/\W/g, '_').trim();
  if (!name) throw new AdminError(400, 'Missing table name');
  if (/^\d/.test(name)) name = `_${name}`;
  if (!IDENTIFIER.test(name)) {
    throw new AdminError(400, `Invalid table name "${raw}"`);
  }
  return name;
}

/** Flatten an exceljs cell value (formula/rich-text cells) to a primitive. */
function normalizeCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('result' in v) return normalizeCellValue(v.result);
    if ('richText' in v && typeof v.text === 'string') return v.text;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return value;
  }
  return String(value);
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(line);
      line = '';
      continue;
    }
    line += ch;
  }
  if (line !== '' || lines.length === 0) lines.push(line);
  const rows = lines.map((l) => parseCsvLine(l)).filter((r) => r.some((c) => c.trim() !== ''));
  return rows;
}

/** Parse a single CSV line into fields (handles quotes and escaped quotes). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function finalizeSheet(raw: unknown[][]): ParsedSheet {
  if (raw.length < 2) throw new AdminError(400, 'File contains no data rows');
  const first = raw[0]!;
  const width = Math.max(...raw.map((r) => r.length));
  if (width === 0) throw new AdminError(400, 'File contains no columns');

  const used = new Set<string>();
  const headers: string[] = [];
  for (let i = 0; i < width; i++) {
    let name = String(first[i] ?? '')
      .replace(/[\r\n\t"]/g, ' ')
      .trim();
    if (!name) name = `column_${i + 1}`;
    let unique = name;
    let suffix = 2;
    while (used.has(unique)) {
      unique = `${name}_${suffix}`;
      suffix++;
    }
    used.add(unique);
    headers.push(unique);
  }

  const rows = raw.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null));
  return { headers, rows };
}

async function parseSheet(data: Uint8Array): Promise<ParsedSheet> {
  if (data.length === 0) throw new AdminError(400, 'File is empty');
  const isZip =
    data.length >= 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    data[2] === 0x03 &&
    data[3] === 0x04;
  if (!isZip) return finalizeSheet(parseCsv(new TextDecoder().decode(data)));

  const workbook = new Workbook();
  // exceljs declares its own global `Buffer` interface that conflicts with
  // @types/node's generic Buffer class; the runtime accepts any byte array.
  await workbook.xlsx.load(Buffer.from(data) as unknown as Parameters<Workbook['xlsx']['load']>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AdminError(400, 'File contains no worksheet');
  const raw: unknown[][] = [];
  sheet.eachRow((row) => {
    if (Array.isArray(row.values)) {
      raw.push(row.values.slice(1).map(normalizeCellValue));
    } else {
      raw.push(Object.values(row.values).map(normalizeCellValue));
    }
  });
  return finalizeSheet(raw);
}

/** Infer a Postgres column type from the values of one column. */
function inferType(values: unknown[]): string {
  const vals = values.filter((v) => v !== null && v !== '');
  if (vals.length === 0) return 'text';
  const all = (pred: (v: unknown) => boolean) => vals.every(pred);
  const isBool = (v: unknown) => typeof v === 'boolean' || v === 'true' || v === 'false';
  const isInt = (v: unknown) =>
    (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && /^-?\d+$/.test(v));
  const isNum = (v: unknown) =>
    (typeof v === 'number' && Number.isFinite(v)) ||
    (typeof v === 'string' && /^-?(\d+\.\d+|\d+|\.\d+)([eE][+-]?\d+)?$/.test(v));
  const isDate = (v: unknown) =>
    v instanceof Date ||
    (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)));
  if (all(isBool)) return 'boolean';
  if (all(isInt)) return 'integer';
  if (all(isNum)) return 'double precision';
  if (all(isDate)) return 'timestamp';
  return 'text';
}

const INSERT_CHUNK_SIZE = 200;

/**
 * Import an Excel/CSV file as a new table in schema "public".
 * Runs in a transaction; any failure rolls back (including the CREATE TABLE).
 */
export async function importTable(
  buffer: Buffer,
  rawTableName: string,
  pool?: PgPoolLike | null
): Promise<AdminImportResult> {
  const db = pool ?? getPool();
  if (!db) throw new AdminError(503, 'Database not configured (set DATABASE_URL)');
  const table = sanitizeTableName(rawTableName);
  const { headers, rows } = await parseSheet(buffer);

  const columns = headers.map((name, i) => {
    const colValues = rows.map((r) => r[i]);
    return {
      name,
      type: inferType(colValues),
      nullable: colValues.some((v) => v === null || v === ''),
    };
  });

  const client: PgClient = await db.connect();
  try {
    await client.query('BEGIN');
    const colDefs = columns
      .map((c) => `"${c.name}" ${c.type}${c.nullable ? '' : ' NOT NULL'}`)
      .join(', ');
    await client.query(`CREATE TABLE public."${table}" (${colDefs})`);

    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, INSERT_CHUNK_SIZE);
      const colList = headers.map((h) => `"${h}"`).join(', ');
      const placeholders = chunk
        .map((_, r) => headers.map((_, c) => `$${r * headers.length + c + 1}`).join(', '))
        .join('), (');
      await client.query(
        `INSERT INTO public."${table}" (${colList}) VALUES (${placeholders})`,
        chunk.flatMap((r) => r)
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return {
    schema: 'public',
    table,
    columns: columns.map((c) => ({ name: c.name, dataType: c.type, nullable: c.nullable })),
    rowsImported: rows.length,
  };
}

// ── Delete table ─────────────────────────────────────────────────────────────

/** Drop a base table (404 if missing, 400 for views, 409 via 2BP01 if dependent objects exist). */
export async function deleteTable(
  rawName: string,
  pool?: PgQueryable | null
): Promise<AdminTableDeleted> {
  const db = requirePool(pool ?? getPool());
  const { schema, table } = parseTableName(rawName);
  const found = await db.query<{ table_type: string }>(
    `SELECT table_type FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  if (found.rows.length === 0) {
    throw new AdminError(404, `Table "${schema}.${table}" not found`);
  }
  if (found.rows[0]!.table_type !== 'BASE TABLE') {
    throw new AdminError(400, 'Views cannot be deleted here (only base tables)');
  }
  await db.query(`DROP TABLE "${schema}"."${table}"`);
  return { schema, table };
}

// ── Postgres SQLSTATE → client error mapping ─────────────────────────────────

const PG_ERRORS: Record<string, { status: number; message: string }> = {
  '2BP01': {
    status: 409,
    message: 'Table has dependent objects (e.g. foreign keys) – drop those first',
  },
  '23503': { status: 409, message: 'Data violates a foreign key constraint' },
  '42703': { status: 400, message: 'Column not found' },
  '42809': { status: 409, message: 'Table already exists' },
  '42P01': { status: 404, message: 'Table not found' },
  '42P16': {
    status: 400,
    message: 'Incompatible column types for this foreign key',
  },
  '22P02': { status: 400, message: 'Invalid value for the column type' },
};

/** Map an unknown error to a client-safe AdminError (null = unmapped). */
export function toAdminError(err: unknown): AdminError | null {
  if (err instanceof AdminError) return err;
  const code =
    typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && code in PG_ERRORS) {
    const { status, message } = PG_ERRORS[code]!;
    return new AdminError(status, message);
  }
  return null;
}

// ── Foreign-key relations ────────────────────────────────────────────────────

interface RelationRow {
  constraint: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
}

const RELATION_SELECT = `
  SELECT c.conname AS "constraint",
         src_ns.nspname AS source_schema,
         src.relname AS source_table,
         src_attn.attname AS source_column,
         tgt_ns.nspname AS target_schema,
         tgt.relname AS target_table,
         tgt_attn.attname AS target_column
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_attribute src_attn ON src_attn.attrelid = c.conrelid AND src_attn.attnum = c.conkey[1]
    JOIN pg_class tgt ON tgt.oid = c.confrelid
    JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
    JOIN pg_attribute tgt_attn ON tgt_attn.attrelid = c.confrelid AND tgt_attn.attnum = c.confkey[1]
`;

function toRelation(row: RelationRow): AdminRelation {
  return {
    constraint: row.constraint,
    sourceSchema: row.source_schema,
    sourceTable: row.source_table,
    sourceColumn: row.source_column,
    targetSchema: row.target_schema,
    targetTable: row.target_table,
    targetColumn: row.target_column,
  };
}

/** List foreign-key relations in user schemas. */
export async function listRelations(pool?: PgQueryable | null): Promise<AdminRelation[]> {
  const db = requirePool(pool ?? getPool());
  const result = await db.query<RelationRow>(
    `${RELATION_SELECT}
     WHERE c.contype = 'f'
       AND src_ns.nspname NOT IN ('pg_catalog', 'information_schema')
     ORDER BY c.conname`
  );
  return result.rows.map(toRelation);
}

function checkIdentifier(name: string, field: string): string {
  if (!IDENTIFIER.test(name)) throw new AdminError(400, `Invalid ${field} "${name}"`);
  return name;
}

/** Create a foreign key (constraint name: `<sourceTable>_<sourceColumn>_fkey`). */
export async function createRelation(
  payload: AdminRelationCreate,
  pool?: PgQueryable | null
): Promise<AdminRelation> {
  const db = requirePool(pool ?? getPool());
  const sourceSchema = payload.sourceSchema
    ? checkIdentifier(payload.sourceSchema, 'source schema')
    : 'public';
  const sourceTable = checkIdentifier(payload.sourceTable, 'source table');
  const sourceColumn = checkIdentifier(payload.sourceColumn, 'source column');
  const targetSchema = payload.targetSchema
    ? checkIdentifier(payload.targetSchema, 'target schema')
    : 'public';
  const targetTable = checkIdentifier(payload.targetTable, 'target table');
  const targetColumn = checkIdentifier(payload.targetColumn, 'target column');

  const [srcCol, tgtCol] = await Promise.all([
    db
      .query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [sourceSchema, sourceTable, sourceColumn]
      )
      .then((r) => r.rows),
    db
      .query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [targetSchema, targetTable, targetColumn]
      )
      .then((r) => r.rows),
  ]);
  if (srcCol.length === 0) {
    throw new AdminError(
      400,
      `Column "${sourceColumn}" not found in "${sourceSchema}.${sourceTable}"`
    );
  }
  if (tgtCol.length === 0) {
    throw new AdminError(
      400,
      `Column "${targetColumn}" not found in "${targetSchema}.${targetTable}"`
    );
  }

  const constraint = `${sourceTable}_${sourceColumn}_fkey`;
  const existing = await db.query(
    `SELECT 1 AS x FROM pg_constraint WHERE conname = $1 AND contype = 'f'`,
    [constraint]
  );
  if (existing.rows.length > 0) {
    throw new AdminError(409, `Relation "${constraint}" already exists`);
  }

  await db.query(
    `ALTER TABLE "${sourceSchema}"."${sourceTable}"
        ADD CONSTRAINT "${constraint}"
        FOREIGN KEY ("${sourceColumn}")
        REFERENCES "${targetSchema}"."${targetTable}" ("${targetColumn}")`
  );
  return toRelation({
    constraint,
    source_schema: sourceSchema,
    source_table: sourceTable,
    source_column: sourceColumn,
    target_schema: targetSchema,
    target_table: targetTable,
    target_column: targetColumn,
  });
}

/** Drop a foreign-key constraint by its Postgres constraint name. */
export async function deleteRelation(
  rawConstraint: string,
  pool?: PgQueryable | null
): Promise<AdminRelation> {
  const db = requirePool(pool ?? getPool());
  const constraint = checkIdentifier(rawConstraint, 'constraint name');
  const found = await db.query<RelationRow>(
    `${RELATION_SELECT}
     WHERE c.conname = $1 AND c.contype = 'f'`,
    [constraint]
  );
  if (found.rows.length === 0) {
    throw new AdminError(404, `Relation "${constraint}" not found`);
  }
  const row = toRelation(found.rows[0]!);
  await db.query(
    `ALTER TABLE "${row.sourceSchema}"."${row.sourceTable}" DROP CONSTRAINT "${constraint}"`
  );
  return row;
}
