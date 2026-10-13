#!/usr/bin/env node
/**
 * SQL MCP Server – exposes PostgreSQL product data via MCP stdio protocol.
 * Tools: search_products, get_product
 * Usage: node scripts/sql-mcp-server.mjs
 * Env:   DATABASE_URL
 */
import { Client } from 'pg';
import { createInterface } from 'node:readline';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://chatbot:chatbot@localhost:5432/chatbot';

const TOOLS = [
  {
    name: 'search_products',
    description:
      'Search products by name, category, location, or description. Returns up to 10 products with name, SKU, price, location, category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords (e.g. "fischbrot", "berlin kaffee")' },
        location: { type: 'string', description: 'Optional: filter by location (Hamburg, Berlin, München)' },
        category: { type: 'string', description: 'Optional: filter by category' },
        limit: { type: 'number', description: 'Max results (default 10, max 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Get a single product by SKU (e.g. "HAM-001"). Returns full details.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Product SKU (e.g. "HAM-001", "BER-006")' },
      },
      required: ['sku'],
    },
  },
];

async function searchProducts(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query ?? '').trim();
  if (!query) return 'Error: "query" parameter is required.';
  const location = args.location ? String(args.location) : null;
  const category = args.category ? String(args.category) : null;
  const limit = Math.min(Number(args.limit) || 10, 20);
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    params.push(query);
    conditions.push(
      `(to_tsvector('german', name || ' ' || coalesce(description, '')) @@ plainto_tsquery('german', $${idx}) OR name ILIKE '%' || $${idx} || '%' OR description ILIKE '%' || $${idx} || '%')`
    );
    idx++;
    if (location) { params.push(location); conditions.push(`location ILIKE $${idx}`); idx++; }
    if (category) { params.push(category); conditions.push(`category = $${idx}`); idx++; }
    params.push(limit);
    const sql = `SELECT sku, name, category, location, price, currency, description, available
      FROM products WHERE ${conditions.join(' AND ')}
      ORDER BY name LIMIT $${idx}`;
    const res = await client.query(sql, params);
    if (res.rows.length === 0) return 'No products found. Try different keywords.';
    return res.rows.map((r) => {
      const avail = r.available ? '' : ' [UNVERFUEGBAR]';
      const desc = r.description ? ': ' + r.description : '';
      return '- ' + r.name + ' [' + r.sku + '] – €' + r.price + ' in ' + r.location + ' (' + r.category + ')' + avail + desc;
    }).join('\n');
  } finally { await client.end(); }
}

async function getProduct(args: Record<string, unknown>): Promise<string> {
  const sku = String(args.sku ?? '').trim().toUpperCase();
  if (!sku) return 'Error: "sku" parameter is required.';
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(
      'SELECT sku, name, category, location, price, currency, description, available FROM products WHERE sku = $1',
      [sku]
    );
    if (res.rows.length === 0) return `Product "${sku}" not found.`;
    const r = res.rows[0];
    return `**${r.name}** [${r.sku}]\n- Price: €${r.price}\n- Location: ${r.location}\n- Category: ${r.category}\n- Available: ${r.available ? 'Yes' : 'No'}\n- Description: ${r.description ?? 'N/A'}`;
  } finally { await client.end(); }
}
function respond(id: number, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function respondError(id: number, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handleRequest(msg: Record<string, unknown>): Promise<void> {
  const id = (msg.id as number) ?? 0;
  const method = msg.method as string;
  const params = (msg.params as Record<string, unknown>) ?? {};
  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'sql-products', version: '1.0.0' },
        });
        break;
      case 'notifications/initialized':
        break;
      case 'tools/list':
        respond(id, { tools: TOOLS });
        break;
      case 'tools/call': {
        const name = params.name as string;
        const args = (params.arguments as Record<string, unknown>) ?? {};
        let result: string;
        if (name === 'search_products') result = await searchProducts(args);
        else if (name === 'get_product') result = await getProduct(args);
        else { respondError(id, -32601, `Unknown tool: ${name}`); return; }
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
  try { void handleRequest(JSON.parse(trimmed)); } catch { /* ignore */ }
});
process.stderr.write(`[sql-mcp] Ready.\n`);
