/**
 * Read-only SQL guard for the admin-db MCP server.
 *
 * Pure module – no side effects, no I/O – so it can be unit-tested in
 * isolation and imported from the .mjs server script.
 *
 * Guarantees (defense in depth):
 *   1. Only a SINGLE statement is accepted (no `;` chaining).
 *   2. It must start with SELECT or WITH (CTE) – plain DML/DDL is rejected
 *      with a clear error.
 *   3. DML/DDL keywords are rejected anywhere in the statement – this also
 *      blocks data-modifying CTEs (`WITH x AS (INSERT ... RETURNING ...)`).
 *      The list deliberately omits words that are also common column names
 *      (set, do, copy, start, release, …) to avoid false positives – the
 *      read-only transaction below is the hard guarantee.
 *   4. The caller executes the statement inside a
 *      `SET TRANSACTION READ ONLY` transaction, so even a bypass of all JS
 *      checks cannot write to the database (Postgres rejects the write).
 *
 * Known trade-off (conservative direction): string literals or quoted
 * identifiers that contain a forbidden keyword (e.g. `WHERE note =
 * 'update'`) are rejected as a false positive. That is accepted: the tool
 * must never allow writes.
 */

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'RENAME',
  'GRANT',
  'REVOKE',
  'VACUUM',
  'LOCK',
  'MERGE',
  'CLUSTER',
  'REINDEX',
  'REFRESH',
  'NOTIFY',
  'LISTEN',
  'UNLISTEN',
  'PREPARE',
  'EXECUTE',
  'DEALLOCATE',
  'DISCARD',
  'SECURITY',
  'SAVEPOINT',
];

/** @type {{ ok: boolean, error?: string, sql?: string }} */
export function validateReadOnlySql(sql) {
  if (typeof sql !== 'string') {
    return { ok: false, error: '"sql" must be a string' };
  }
  // Allow a single trailing semicolon (or several), but no mid-statement ones.
  let trimmed = sql.trim();
  while (trimmed.endsWith(';')) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  if (!trimmed) {
    return { ok: false, error: 'empty SQL statement' };
  }
  if (trimmed.includes(';')) {
    return {
      ok: false,
      error: 'multiple statements are not allowed – send exactly one SELECT',
    };
  }
  const upper = trimmed.toUpperCase();
  if (!/^\s*SELECT\b/.test(upper) && !/^\s*WITH\b/.test(upper)) {
    return {
      ok: false,
      error:
        'only read-only queries are allowed – the statement must start with SELECT or WITH ... SELECT',
    };
  }
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(trimmed)) {
      return {
        ok: false,
        error: `statement contains forbidden keyword "${keyword}" (admin-db is read-only)`,
      };
    }
  }
  return { ok: true, sql: trimmed };
}
