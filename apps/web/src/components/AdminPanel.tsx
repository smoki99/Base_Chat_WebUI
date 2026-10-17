import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AdminImportResult, AdminRelation, AdminTable, AdminTablePreview } from 'shared';
import { ApiError, adminDownload, adminRequest } from '../lib/api';

interface AdminPanelProps {
  /** Controls whether the dialog is visible. */
  open: boolean;
  /** Closes the dialog (backdrop, ×, Escape). */
  onClose: () => void;
}

type Tab = 'tables' | 'relations';

interface Notice {
  kind: 'success' | 'danger';
  text: string;
}

export interface RelationDraft {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

const EMPTY_RELATION: RelationDraft = {
  sourceTable: '',
  sourceColumn: '',
  targetTable: '',
  targetColumn: '',
};

const TOKEN_STORAGE_KEY = 'admin_token';

/** Read the persisted admin token (empty string when unset). */
function readStoredToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistToken(token: string) {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode) – token stays in memory only.
  }
}

/** Render a cell value for the preview table. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Footer hint for the preview ("50 rows loaded …"). */
function previewFooter(preview: AdminTablePreview): string {
  if (preview.hasMore) {
    return `${preview.limit} Zeilen geladen – die Tabelle enthält weitere Zeilen.`;
  }
  return `${preview.limit} Zeilen geladen.`;
}

/** Badge class + label for a table kind. */
function kindBadge(kind: AdminTable['kind']): { className: string; label: string } {
  if (kind === 'table') {
    return { className: 'text-bg-secondary', label: 'Tabelle' };
  }
  return { className: 'text-bg-info', label: 'View' };
}

/** Table list + preview + import form (the "Tabellen" tab). */
function TablesTab(props: {
  tables: AdminTable[] | null;
  selected: string | null;
  preview: AdminTablePreview | null;
  busy: boolean;
  onRefresh: () => void;
  onPreview: (name: string) => void;
  onDelete: (name: string) => void;
  importFile: File | null;
  importName: string;
  fileRef: RefObject<HTMLInputElement | null>;
  onFileChange: (file: File | null) => void;
  onNameChange: (name: string) => void;
  onImport: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
}) {
  const { tables, selected, busy } = props;

  return (
    <div className="mt-3" role="tabpanel" aria-label="Tabellen">
      <button
        type="button"
        className="btn btn-outline-secondary mb-3"
        onClick={props.onRefresh}
        disabled={busy}
      >
        ↻ Aktualisieren
      </button>

      <TablesList
        tables={tables}
        selected={selected}
        busy={busy}
        onPreview={props.onPreview}
        onDelete={props.onDelete}
      />
      {props.preview && (
        <PreviewSection preview={props.preview} busy={props.busy} onExport={props.onExport} />
      )}

      <section className="customize-section mt-4" aria-label="Import">
        <h3 className="customize-section-title">Tabelle importieren (Excel/CSV)</h3>
        <div className="row g-2 align-items-end">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="admin-import-file">
              Datei
            </label>
            <input
              id="admin-import-file"
              ref={props.fileRef}
              type="file"
              className="form-control"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => props.onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="col-sm-4">
            <label className="form-label" htmlFor="admin-import-name">
              Name (optional)
            </label>
            <input
              id="admin-import-name"
              className="form-control"
              value={props.importName}
              placeholder="aus Dateiname"
              onChange={(e) => props.onNameChange(e.target.value)}
            />
          </div>
          <div className="col-sm-2">
            <button
              type="button"
              className="btn btn-primary w-100"
              onClick={props.onImport}
              disabled={busy}
            >
              Import
            </button>
          </div>
        </div>
        <div className="form-text">
          Legt eine neue Tabelle an (erste Zeile = Spaltennamen, max. 25 MB).
        </div>
      </section>
    </div>
  );
}

/** Table list with loading/empty states (early returns keep it simple). */
function TablesList(props: {
  tables: AdminTable[] | null;
  selected: string | null;
  busy: boolean;
  onPreview: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  if (props.tables === null) {
    return <p className="form-text">Lade Tabellen …</p>;
  }
  if (props.tables.length === 0) {
    return <p className="form-text">Keine Tabellen vorhanden.</p>;
  }
  return (
    <div className="list-group mb-3" role="list">
      {props.tables.map((t) => (
        <TableRow
          key={`${t.schema}.${t.table}`}
          table={t}
          selected={props.selected === t.table}
          busy={props.busy}
          onPreview={props.onPreview}
          onDelete={props.onDelete}
        />
      ))}
    </div>
  );
}

/** Preview table for the selected table. */
function PreviewSection({
  preview,
  busy,
  onExport,
}: {
  preview: AdminTablePreview;
  busy: boolean;
  onExport: (format: 'csv' | 'xlsx') => void;
}) {
  return (
    <section className="customize-section" aria-label="Vorschau">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <h3 className="customize-section-title mb-0">
          {preview.schema}.{preview.table}
        </h3>
        <div className="btn-group" role="group" aria-label="Tabelle exportieren">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onExport('csv')}
            disabled={busy}
            title="Als CSV herunterladen"
          >
            CSV
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onExport('xlsx')}
            disabled={busy}
            title="Als Excel-Datei herunterladen"
          >
            XLSX
          </button>
        </div>
      </div>
      <div className="table-responsive" style={{ maxHeight: '320px' }}>
        <table className="table table-sm table-striped align-top">
          <thead>
            <tr>
              {preview.columns.map((c) => (
                <th
                  key={c.name}
                  scope="col"
                  title={`${c.dataType}${c.nullable ? '' : ' (NOT NULL)'}`}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.length === 0 && (
              <tr>
                <td colSpan={preview.columns.length} className="text-muted">
                  Keine Zeilen
                </td>
              </tr>
            )}
            {preview.rows.map((row, i) => (
              <tr key={i}>
                {preview.columns.map((c) => (
                  <td key={c.name}>{cellText(row[c.name])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-text">{previewFooter(preview)}</div>
    </section>
  );
}

/** One row of the table list: name, kind badge, delete button. */

/** One row of the table list: name, kind badge, delete button. */
function TableRow(props: {
  table: AdminTable;
  selected: boolean;
  busy: boolean;
  onPreview: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const badge = kindBadge(props.table.kind);
  return (
    <div
      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2${
        props.selected ? ' active' : ''
      }`}
      onClick={() => props.onPreview(props.table.table)}
    >
      <span>
        {props.table.table} <span className={`badge ${badge.className}`}>{badge.label}</span>
      </span>
      {props.table.kind === 'table' && (
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          disabled={props.busy}
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete(props.table.table);
          }}
          aria-label={`Tabelle ${props.table.table} löschen`}
        >
          Löschen
        </button>
      )}
    </div>
  );
}

/** FK relation form + list (the "Beziehungen" tab). */
function RelationsTab(props: {
  relations: AdminRelation[] | null;
  rel: RelationDraft;
  busy: boolean;
  onRefresh: () => void;
  onRelChange: (patch: Partial<RelationDraft>) => void;
  onCreate: () => void;
  onDelete: (constraint: string) => void;
}) {
  const incomplete =
    !props.rel.sourceTable ||
    !props.rel.sourceColumn ||
    !props.rel.targetTable ||
    !props.rel.targetColumn;

  return (
    <div className="mt-3" role="tabpanel" aria-label="Beziehungen">
      <section className="customize-section" aria-label="Beziehung anlegen">
        <h3 className="customize-section-title">Beziehung anlegen</h3>
        <div className="row g-2">
          <RelationInput
            id="rel-source-table"
            label="Von Tabelle"
            value={props.rel.sourceTable}
            onChange={(v) => props.onRelChange({ sourceTable: v })}
          />
          <RelationInput
            id="rel-source-column"
            label="Von Spalte"
            value={props.rel.sourceColumn}
            onChange={(v) => props.onRelChange({ sourceColumn: v })}
          />
          <RelationInput
            id="rel-target-table"
            label="Nach Tabelle"
            value={props.rel.targetTable}
            onChange={(v) => props.onRelChange({ targetTable: v })}
          />
          <RelationInput
            id="rel-target-column"
            label="Nach Spalte"
            value={props.rel.targetColumn}
            onChange={(v) => props.onRelChange({ targetColumn: v })}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary mt-2"
          onClick={props.onCreate}
          disabled={props.busy || incomplete}
        >
          Beziehung erstellen
        </button>
      </section>

      <section className="customize-section" aria-label="Bestehende Beziehungen">
        <h3 className="customize-section-title">Bestehende Beziehungen</h3>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mb-2"
          onClick={props.onRefresh}
          disabled={props.busy}
        >
          ↻ Aktualisieren
        </button>
        <RelationsList relations={props.relations} busy={props.busy} onDelete={props.onDelete} />
      </section>
    </div>
  );
}

/** Relation list with loading/empty states (early returns keep it simple). */
function RelationsList(props: {
  relations: AdminRelation[] | null;
  busy: boolean;
  onDelete: (constraint: string) => void;
}) {
  if (props.relations === null) {
    return <p className="form-text">Lade Beziehungen …</p>;
  }
  if (props.relations.length === 0) {
    return <p className="form-text">Keine Fremdschlüssel-Beziehungen.</p>;
  }
  return (
    <ul className="list-group">
      {props.relations.map((r) => (
        <RelationRow key={r.constraint} relation={r} busy={props.busy} onDelete={props.onDelete} />
      ))}
    </ul>
  );
}

/** One labeled input of the relation form. */
function RelationInput(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="col-6 col-sm-3">
      <label className="form-label" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        className="form-control"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

/** One row of the relation list. */
function RelationRow(props: {
  relation: AdminRelation;
  busy: boolean;
  onDelete: (constraint: string) => void;
}) {
  const r = props.relation;
  return (
    <li className="list-group-item d-flex justify-content-between align-items-center gap-2">
      <span>
        <code>
          {r.sourceTable}.{r.sourceColumn}
        </code>{' '}
        →{' '}
        <code>
          {r.targetTable}.{r.targetColumn}
        </code>{' '}
        <span className="badge text-bg-secondary">{r.constraint}</span>
      </span>
      <button
        type="button"
        className="btn btn-sm btn-outline-danger"
        disabled={props.busy}
        onClick={() => props.onDelete(r.constraint)}
        aria-label={`Beziehung ${r.constraint} löschen`}
      >
        Löschen
      </button>
    </li>
  );
}

/**
 * Admin dialog for the Postgres table manager:
 * table list + preview + delete, Excel/CSV import, FK relation CRUD.
 * All actions require the ADMIN_TOKEN (persisted locally).
 */
export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('tables');
  const [token, setToken] = useState(readStoredToken);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [tables, setTables] = useState<AdminTable[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminTablePreview | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [relations, setRelations] = useState<AdminRelation[] | null>(null);
  const [rel, setRel] = useState<RelationDraft>(EMPTY_RELATION);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const ok = useCallback((text: string) => setNotice({ kind: 'success', text }), []);
  const fail = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      setNotice({ kind: 'danger', text: err.message });
      return;
    }
    setNotice({ kind: 'danger', text: 'Unerwarteter Fehler' });
  }, []);

  /** Run an async action with busy bookkeeping; returns null on failure. */
  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      fail(err);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const loadTables = useCallback(
    () =>
      run(async () => {
        const data = await adminRequest<AdminTable[]>('/tables', token);
        setTables(data);
        setSelected(null);
        setPreview(null);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  const loadRelations = useCallback(
    () =>
      run(async () => {
        setRelations(await adminRequest<AdminRelation[]>('/relations', token));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  // Refresh the active tab's data when the dialog opens or the token changes.
  useEffect(() => {
    if (!open) return;
    if (tab === 'tables') void loadTables();
    else void loadRelations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, token]);

  async function handlePreview(name: string) {
    setSelected(name);
    const data = await run(() =>
      adminRequest<AdminTablePreview>(`/tables/${encodeURIComponent(name)}/preview`, token)
    );
    if (data) setPreview(data);
  }

  /** Download the selected table as CSV or XLSX (read-only export). */
  async function handleExport(format: 'csv' | 'xlsx') {
    if (!selected) return;
    const done = await run(async () => {
      await adminDownload(
        `/tables/${encodeURIComponent(selected)}/export?format=${format}`,
        token,
        `${selected}.${format}`
      );
      return true;
    });
    if (done) ok(`Export gestartet – bitte Downloads prüfen.`);
  }

  async function handleDeleteTable(name: string) {
    if (!window.confirm(`Tabelle "${name}" wirklich löschen? Alle Daten gehen verloren.`)) {
      return;
    }
    if (
      await run(() =>
        adminRequest<unknown>(`/tables/${encodeURIComponent(name)}`, token, { method: 'DELETE' })
      )
    ) {
      ok(`Tabelle "${name}" gelöscht.`);
      if (selected === name) {
        setSelected(null);
        setPreview(null);
      }
      void loadTables();
    }
  }

  async function handleImport() {
    if (!importFile) {
      setNotice({ kind: 'danger', text: 'Bitte eine Excel- oder CSV-Datei wählen.' });
      return;
    }
    const form = new FormData();
    form.append('file', importFile);
    const trimmed = importName.trim();
    if (trimmed) form.append('table', trimmed);
    const data = await run(async () => {
      const res = await fetch('/api/admin/tables/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: AdminImportResult;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        const message = payload?.error?.message ?? `Request fehlgeschlagen (${res.status})`;
        throw new ApiError(res.status, message);
      }
      return payload?.data as AdminImportResult;
    });
    if (data) {
      ok(`Tabelle "${data.table}" angelegt – ${data.rowsImported} Zeilen importiert.`);
      setImportFile(null);
      setImportName('');
      if (fileRef.current) fileRef.current.value = '';
      void loadTables();
    }
  }

  async function handleCreateRelation() {
    if (
      await run(() =>
        adminRequest<AdminRelation>('/relations', token, {
          method: 'POST',
          body: JSON.stringify(rel),
        })
      )
    ) {
      ok('Beziehung angelegt.');
      setRel(EMPTY_RELATION);
      void loadRelations();
    }
  }

  async function handleDeleteRelation(constraint: string) {
    if (!window.confirm(`Beziehung "${constraint}" wirklich löschen?`)) return;
    if (
      await run(() =>
        adminRequest<unknown>(`/relations/${encodeURIComponent(constraint)}`, token, {
          method: 'DELETE',
        })
      )
    ) {
      ok('Beziehung gelöscht.');
      void loadRelations();
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="modal settings-modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title" id="admin-title">
                Datenbank-Verwaltung
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Schließen"
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label" htmlFor="admin-token">
                  Admin-Token
                </label>
                <input
                  id="admin-token"
                  className="form-control"
                  type="password"
                  value={token}
                  placeholder="ADMIN_TOKEN aus .env"
                  onChange={(e) => {
                    const value = e.target.value;
                    setToken(value);
                    persistToken(value);
                    // A stale auth error no longer applies once the user edits
                    // the token – clear it instead of leaving the old 403/401
                    // message hanging above the tabs.
                    if (notice) setNotice(null);
                  }}
                  autoComplete="off"
                />
                <div className="form-text">Benötigt für alle Aktionen (ADMIN_TOKEN der API).</div>
              </div>

              {notice && <NoticeAlert notice={notice} />}

              <nav
                className="nav nav-tabs settings-tabs"
                role="tablist"
                aria-label="Verwaltungsbereiche"
              >
                <button
                  type="button"
                  role="tab"
                  className={`nav-link${tab === 'tables' ? ' active' : ''}`}
                  aria-selected={tab === 'tables'}
                  onClick={() => setTab('tables')}
                >
                  Tabellen
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`nav-link${tab === 'relations' ? ' active' : ''}`}
                  aria-selected={tab === 'relations'}
                  onClick={() => setTab('relations')}
                >
                  Beziehungen
                </button>
              </nav>

              {tab === 'tables' ? (
                <TablesTab
                  tables={tables}
                  selected={selected}
                  preview={preview}
                  busy={busy}
                  onRefresh={() => void loadTables()}
                  onPreview={(name) => void handlePreview(name)}
                  onDelete={(name) => void handleDeleteTable(name)}
                  importFile={importFile}
                  importName={importName}
                  fileRef={fileRef}
                  onFileChange={(file) => setImportFile(file)}
                  onNameChange={(name) => setImportName(name)}
                  onImport={() => void handleImport()}
                  onExport={(format) => void handleExport(format)}
                />
              ) : (
                <RelationsTab
                  relations={relations}
                  rel={rel}
                  busy={busy}
                  onRefresh={() => void loadRelations()}
                  onRelChange={(patch) => setRel((r) => ({ ...r, ...patch }))}
                  onCreate={() => void handleCreateRelation()}
                  onDelete={(constraint) => void handleDeleteRelation(constraint)}
                />
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Fertig
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Success/danger feedback banner. */
function NoticeAlert({ notice }: { notice: Notice }) {
  if (notice.kind === 'danger') {
    return (
      <div className="alert alert-danger py-2" role="alert">
        {notice.text}
      </div>
    );
  }
  return (
    <div className="alert alert-success py-2" role="status">
      {notice.text}
    </div>
  );
}
