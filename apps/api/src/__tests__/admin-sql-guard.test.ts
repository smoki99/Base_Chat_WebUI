import { describe, it, expect } from 'vitest';
import { validateReadOnlySql, type SqlValidation } from '../../scripts/lib/admin-sql-guard.mjs';

// The runtime guard is defensive about non-string input; the declared API is `string`.
const validateAny = validateReadOnlySql as (sql: unknown) => SqlValidation;

describe('admin-sql-guard: validateReadOnlySql', () => {
  it('accepts a plain SELECT', () => {
    const res = validateReadOnlySql('SELECT * FROM products');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.sql).toBe('SELECT * FROM products');
  });

  it('accepts SELECT with WHERE, JOINs, aggregates and LIMIT', () => {
    const res = validateReadOnlySql(
      `SELECT p.name, COUNT(*) AS n
         FROM products p
         JOIN categories c ON c.id = p.category
        WHERE p.name ILIKE '%fisch%'
        GROUP BY p.name
        HAVING COUNT(*) > 1
        ORDER BY n DESC
        LIMIT 10`
    );
    expect(res.ok).toBe(true);
  });

  it('accepts WITH ... SELECT (CTE)', () => {
    const res = validateReadOnlySql(
      'WITH top AS (SELECT name FROM products ORDER BY price DESC LIMIT 5) SELECT * FROM top'
    );
    expect(res.ok).toBe(true);
  });

  it('strips a trailing semicolon (single statement stays valid)', () => {
    const res = validateReadOnlySql('SELECT 1;');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.sql).toBe('SELECT 1');
  });

  it('rejects multi-statement input (SQL injection via ;)', () => {
    const res = validateReadOnlySql('SELECT 1; DROP TABLE products');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/multiple statements/i);
  });

  it('rejects statements that do not start with SELECT/WITH', () => {
    for (const sql of ['INSERT INTO t VALUES (1)', 'UPDATE t SET x = 1', 'DELETE FROM t']) {
      const res = validateReadOnlySql(sql);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/read-only/i);
    }
  });

  it('rejects data-modifying CTEs (WITH x AS (INSERT ...))', () => {
    const res = validateReadOnlySql(
      'WITH x AS (INSERT INTO t VALUES (1) RETURNING 1) SELECT * FROM x'
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/forbidden keyword/i);
  });

  it('rejects DDL and admin keywords inside a SELECT-shaped statement', () => {
    for (const keyword of ['DROP', 'TRUNCATE', 'GRANT', 'VACUUM', 'MERGE']) {
      const res = validateReadOnlySql(`SELECT * FROM t -- ${keyword} now`);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain(keyword);
    }
  });

  it('does not reject keywords that are part of a longer identifier (update_date)', () => {
    const res = validateReadOnlySql('SELECT update_date, delete_flag FROM t');
    expect(res.ok).toBe(true);
  });

  it('rejects empty / whitespace / non-string input', () => {
    expect(validateReadOnlySql('').ok).toBe(false);
    expect(validateReadOnlySql('   \n  ').ok).toBe(false);
    expect(validateAny(undefined).ok).toBe(false);
    expect(validateAny(42).ok).toBe(false);
  });
});
