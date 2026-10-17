#!/usr/bin/env node
/**
 * Admin DB MCP Server – read-only access to the Postgres admin database
 * (imported tables from the Admin-UI) via the MCP stdio protocol.
 *
 * Server name: admin-db
 * Tools:       list_tables, search_tables, run_sql (strictly read-only)
 * Usage:       node scripts/admin-db-mcp-server.mjs
 * Env:         DATABASE_URL
 *
 * Security: run_sql validates the statement (lib/admin-sql-guard.mjs) and
 * executes it inside a READ ONLY transaction – writes are impossible.
 */
import { Client } from 'pg';
import { createInterface } from 'node:readline';
import { validateReadOnlySql } from './lib/admin-sql-guard.mjs';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://chatbot:chatbot@localhost:5432/chatbot';
const MAX_ROWS = Math.min(Number(process.env.ADMIN_MCP_MAX_ROWS) || 200, 1000);
const STATEMENT_TIMEOUT_MS = Number(process.env.ADMIN_MCP_STATEMENT_TIMEOUT_MS) || 10_000;

const TOOLS = [
  {
    name: 'list_tables',
    description:
      'List all user tables with approximate row counts and their columns (name + type). Use this first to discover what data exists before writing a query.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_tables',
    description:
      'Search table names and column names for a keyword (case-insensitive). Returns matching tables with the matched columns. Use when you are not sure which table holds the data.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search for (e.g. "kunde", "preis")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_sql',
    description:
      'Execute a READ-ONLY SQL query against the admin database. Only a single SELECT or WITH ... SELECT statement is accepted; any write (INSERT/UPDATE/DELETE/DDL) or multiple statements are rejected. Add LIMIT for large tables. Returns up to 200 rows as text.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'A single read-only SELECT (or WITH ... SELECT) statement',
        },
      },
      required: ['sql'],
    },
  },
];

async function withClient(fn) {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema'];

async function listTables() {
  return withClient(async (client) => {
    const tables = await client.query(
      `SELECT table_schema, table_name
         FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ($1, $2)
        ORDER BY table_schema, table_name`,
      SYSTEM_SCHEMAS
    );
    if (tables.rows.length === 0) {
      return 'Keine Tabellen gefunden. Importiere zuerst Daten im Admin-Panel.';
    }
    const names = tables.rows.map((r) => r.table_name);
    const countRes = await client.query(
      `SELECT relname AS table_name, n_live_tup
         FROM pg_stat_user_tables
        WHERE relname = ANY($1)`,
      [names]
    );
    const cols = await client.query(
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_name = ANY($1)
          AND table_schema NOT IN ($2, $3)
        ORDER BY table_name, ordinal_position`,
      [names, ...SYSTEM_SCHEMAS]
    );
    const byTable = new Map();
    for (const c of cols.rows) {
      if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
      byTable.get(c.table_name).push(`${c.column_name} (${c.data_type})`);
    }
    const countByName = new Map(countRes.rows.map((r) => [r.table_name, r.n_live_tup]));
    const lines = tables.rows.map((t) => {
      const columns = (byTable.get(t.table_name) ?? []).slice(0, 30).join(', ');
      const rows = countByName.get(t.table_name) ?? 0;
      return `- ${t.table_name} (≈${rows} Zeilen): ${columns}`;
    });
    return `Tabellen in der Admin-Datenbank (${tables.rows.length}):\n` + lines.join('\n');
  });
}

async function searchTables({ query }) {
  const q = String(query ?? '').trim();
  if (!q) return 'Bitte ein Suchwort ("query") angeben.';
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema NOT IN ($2, $3)
          AND (table_name ILIKE '%' || $1 || '%' OR column_name ILIKE '%' || $1 || '%')
        ORDER BY table_name, ordinal_position
        LIMIT 100`,
      [q, ...SYSTEM_SCHEMAS]
    );
    if (res.rows.length === 0) {
      return `Keine Tabellen oder Spalten gefunden für "${q}".`;
    }
    const byTable = new Map();
    for (const r of res.rows) {
      if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
      byTable.get(r.table_name).push(r.column_name);
    }
    const lines = [...byTable.entries()].map(
      ([t, columns]) => `- ${t}: ${columns.slice(0, 30).join(', ')}`
    );
    return `Treffer für "${q}" (${byTable.size} Tabellen):\n` + lines.join('\n');
  });
}

function formatValue(v) {
  if (v === null || v === undefined) return '';
  const text = String(v);
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

function formatRows(rows) {
  if (rows.length === 0) return 'Keine Zeilen.';
  const columns = Object.keys(rows[0]);
  const header = columns.join(' | ');
  const body = rows
    .slice(0, MAX_ROWS)
    .map((r) => columns.map((c) => formatValue(r[c])).join(' | '));
  const note =
    rows.length > MAX_ROWS
      ? `\n(gezeigt: ${MAX_ROWS} von ${rows.length} Zeilen – nutze LIMIT)`
      : '';
  return `${rows.length} Zeile(n)\n${header}\n${body.join('\n')}${note}`;
}

async function runSql({ sql }) {
  const check = validateReadOnlySql(sql);
  if (!check.ok) return `Verweigert: ${check.error}`;
  return withClient(async (client) => {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    try {
      const res = await client.query(check.sql);
      await client.query('COMMIT');
      return formatRows(res.rows);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
  });
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handleRequest(msg) {
  const id = msg.id ?? 0;
  const method = msg.method;
  const params = msg.params ?? {};
  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'admin-db', version: '1.0.0' },
        });
        break;
      case 'notifications/initialized':
        break;
      case 'tools/list':
        respond(id, { tools: TOOLS });
        break;
      case 'tools/call': {
        const name = params.name;
        const args = params.arguments ?? {};
        let result;
        if (name === 'list_tables') result = await listTables();
        else if (name === 'search_tables') result = await searchTables(args);
        else if (name === 'run_sql') result = await runSql(args);
        else {
          respondError(id, -32601, `Unknown tool: ${name}`);
          return;
        }
        respond(id, { content: [{ type: 'text', text: result }] });
        break;
      }
      default:
        if (!msg.id) return;
        respondError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (id) respondError(id, -32603, err instanceof Error ? err.message : String(err));
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    void handleRequest(JSON.parse(trimmed));
  } catch {
    /* ignore malformed lines */
  }
});
process.stderr.write('[admin-db-mcp] Ready.\n');
