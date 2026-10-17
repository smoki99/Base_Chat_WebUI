// ── Admin (Postgres table manager) ────────────────────────────────────────────

/** A table or view returned by GET /api/admin/tables. */
export interface AdminTable {
  schema: string;
  table: string;
  /** "BASE TABLE" or "VIEW". */
  kind: 'table' | 'view';
}

/** Column metadata for a table preview. */
export interface AdminTableColumn {
  name: string;
  /** Postgres data type, e.g. "integer", "text". */
  dataType: string;
  nullable: boolean;
}

/** Response data of GET /api/admin/tables/:name/preview. */
export interface AdminTablePreview {
  schema: string;
  table: string;
  columns: AdminTableColumn[];
  /** Row values keyed by column name (stringified by the API). */
  rows: Record<string, unknown>[];
  /** True when the table has more rows than `limit`. */
  hasMore: boolean;
  limit: number;
}

/** Result of POST /api/admin/tables/import (Excel/CSV upload). */
export interface AdminImportResult {
  schema: string;
  table: string;
  /** Columns created for the import (name + inferred Postgres type). */
  columns: AdminTableColumn[];
  /** Number of data rows inserted. */
  rowsImported: number;
}

/** Result of DELETE /api/admin/tables/:name. */
export interface AdminTableDeleted {
  schema: string;
  table: string;
}

/** A foreign-key relation returned by GET /api/admin/relations. */
export interface AdminRelation {
  /** Postgres constraint name (also the identifier for deletion). */
  constraint: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

/** Request body of POST /api/admin/relations. Schemas default to "public". */
export interface AdminRelationCreate {
  sourceSchema?: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema?: string;
  targetTable: string;
  targetColumn: string;
}
