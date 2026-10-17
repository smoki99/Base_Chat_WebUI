/**
 * Type declarations for `admin-sql-guard.mjs` (plain-JS module shared with the
 * admin-db MCP server). Kept in sync with the runtime implementation.
 */

export type SqlValidation = { ok: true; sql: string } | { ok: false; error: string };

/**
 * Validates that `sql` is exactly one read-only statement starting with
 * SELECT (or WITH ... SELECT) and containing no DML/DDL keywords.
 */
export declare function validateReadOnlySql(sql: string): SqlValidation;
