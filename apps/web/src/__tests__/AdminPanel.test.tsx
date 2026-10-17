import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPanel } from '../components/AdminPanel';

/** Minimal Response-like mock with the fields the app actually uses. */
function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

type RouteHandler = (init?: RequestInit) => { status: number; body: unknown };

/** Stub global fetch with method+path keyed routes. Unmocked calls fail loudly. */
function setupFetch(routes: Record<string, RouteHandler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const route = routes[`${method} ${url}`] ?? routes[url];
    if (!route) throw new Error(`unmocked fetch: ${method} ${url}`);
    const { status, body } = route(init);
    return jsonResponse(status, body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const tables = [
  { schema: 'public', table: 'kunden', kind: 'table' as const },
  { schema: 'public', table: 'view_auftraege', kind: 'view' as const },
];

const preview = {
  schema: 'public',
  table: 'kunden',
  limit: 50,
  hasMore: false,
  columns: [
    { name: 'id', dataType: 'integer', nullable: false },
    { name: 'name', dataType: 'text', nullable: true },
  ],
  rows: [
    { id: 1, name: 'Alice' },
    { id: 2, name: null },
  ],
};

const relations = [
  {
    constraint: 'fk_bestellungen_kunden',
    sourceTable: 'bestellungen',
    sourceColumn: 'kundennr',
    targetTable: 'kunden',
    targetColumn: 'id',
  },
];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderOpen() {
  const onClose = vi.fn();
  const utils = render(<AdminPanel open={true} onClose={onClose} />);
  return { onClose, ...utils };
}

describe('AdminPanel – rendering', () => {
  it('renders nothing when closed', () => {
    setupFetch({});
    render(<AdminPanel open={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Admin-Token')).not.toBeInTheDocument();
  });

  it('renders title, token field and tabs when open', () => {
    setupFetch({ 'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }) });
    renderOpen();
    expect(screen.getByText('Datenbank-Verwaltung')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin-Token')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tabellen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Beziehungen' })).toBeInTheDocument();
  });

  it('requests tables with the Bearer token header', async () => {
    window.localStorage.setItem('admin_token', 'geheim');
    const fetchMock = setupFetch({
      'GET /api/admin/tables': (init) => {
        const sent = new Headers(init?.headers);
        expect(sent.get('Authorization')).toBe('Bearer geheim');
        return { status: 200, body: { data: tables } };
      },
    });
    renderOpen();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('kunden')).toBeInTheDocument());
  });

  it('shows an empty state for zero tables', async () => {
    setupFetch({ 'GET /api/admin/tables': () => ({ status: 200, body: { data: [] } }) });
    renderOpen();
    await waitFor(() => expect(screen.getByText('Keine Tabellen vorhanden.')).toBeInTheDocument());
  });

  it('shows a danger alert when the API rejects with 401', async () => {
    setupFetch({
      'GET /api/admin/tables': () => ({
        status: 401,
        body: { error: { message: 'Ungültiges Admin-Token' } },
      }),
    });
    renderOpen();
    await waitFor(() =>
      expect(screen.getByText('Ungültiges Admin-Token')).toHaveClass('alert-danger')
    );
  });

  it('closes on Escape', () => {
    setupFetch({ 'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }) });
    const { onClose } = renderOpen();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AdminPanel – preview', () => {
  it('loads and renders the preview on table click', async () => {
    const fetchMock = setupFetch({
      'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }),
      'GET /api/admin/tables/kunden/preview': () => ({ status: 200, body: { data: preview } }),
    });
    renderOpen();
    fireEvent.click(await screen.findByText('kunden'));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/tables/kunden/preview', expect.anything())
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('∅')).toBeInTheDocument();
    expect(screen.getByText('50 Zeilen geladen.')).toBeInTheDocument();
  });
});
describe('AdminPanel – delete table', () => {
  it('does not delete when confirm is declined', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );
    const fetchMock = setupFetch({
      'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }),
    });
    renderOpen();
    fireEvent.click(await screen.findByRole('button', { name: 'Tabelle kunden löschen' }));
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial list load
    expect(screen.queryByText('Tabelle "kunden" gelöscht.')).not.toBeInTheDocument();
  });

  it('deletes when confirmed and reloads the list', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    const fetchMock = setupFetch({
      'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }),
      'DELETE /api/admin/tables/kunden': () => ({
        status: 200,
        body: { data: { schema: 'public', table: 'kunden' } },
      }),
    });
    renderOpen();
    fireEvent.click(await screen.findByRole('button', { name: 'Tabelle kunden löschen' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/tables/kunden',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    await waitFor(() => expect(screen.getByText('Tabelle "kunden" gelöscht.')).toBeInTheDocument());
  });
});

describe('AdminPanel – import', () => {
  const importRoute = () => ({
    status: 200,
    body: { data: { table: 'kunden', schema: 'public', columnsInferred: 3, rowsImported: 2 } },
  });

  it('refuses to import without a file', async () => {
    setupFetch({
      'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }),
    });
    renderOpen();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    await waitFor(() =>
      expect(screen.getByText('Bitte eine Excel- oder CSV-Datei wählen.')).toBeInTheDocument()
    );
  });

  it('uploads file + optional table name as multipart form data', async () => {
    setupFetch({
      'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }),
      'POST /api/admin/tables/import': importRoute,
    });
    const file = new File(['name,alter\nAlice,30\nBob,25'], 'daten.csv', { type: 'text/csv' });
    renderOpen();
    fireEvent.change(screen.getByLabelText('Datei'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'kunden' } });
    const importBtn = screen.getByRole('button', { name: 'Import' });
    await waitFor(() => expect(importBtn).toBeEnabled());
    fireEvent.click(importBtn);
    await waitFor(() =>
      expect(screen.getByText('Tabelle "kunden" angelegt – 2 Zeilen importiert.')).toHaveClass(
        'alert-success'
      )
    );
  });

  it('shows the server error on conflict', async () => {
    setupFetch({
      'GET /api/admin/tables': () => ({ status: 200, body: { data: tables } }),
      'POST /api/admin/tables/import': () => ({
        status: 409,
        body: { error: { message: 'Tabelle "kunden" existiert bereits' } },
      }),
    });
    const file = new File(['name\nAlice'], 'daten.csv', { type: 'text/csv' });
    renderOpen();
    fireEvent.change(screen.getByLabelText('Datei'), { target: { files: [file] } });
    const importBtn = screen.getByRole('button', { name: 'Import' });
    await waitFor(() => expect(importBtn).toBeEnabled());
    fireEvent.click(importBtn);
    await waitFor(() =>
      expect(screen.getByText('Tabelle "kunden" existiert bereits')).toHaveClass('alert-danger')
    );
  });
});

describe('AdminPanel – relations', () => {
  it('lists relations after switching to the relations tab', async () => {
    const fetchMock = setupFetch({
      'GET /api/admin/relations': () => ({ status: 200, body: { data: relations } }),
    });
    renderOpen();
    fireEvent.click(screen.getByRole('tab', { name: 'Beziehungen' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/relations', expect.anything())
    );
    await waitFor(() => expect(screen.getByText('fk_bestellungen_kunden')).toBeInTheDocument());
    expect(screen.getByText('bestellungen.kundennr')).toBeInTheDocument();
  });

  it('disables the create button while the form is incomplete', async () => {
    setupFetch({ 'GET /api/admin/relations': () => ({ status: 200, body: { data: relations } }) });
    renderOpen();
    fireEvent.click(screen.getByRole('tab', { name: 'Beziehungen' }));
    const button = await screen.findByRole('button', { name: 'Beziehung erstellen' });
    expect(button).toBeDisabled();
  });

  it('creates a relation from the form and resets it', async () => {
    const fetchMock = setupFetch({
      'GET /api/admin/relations': () => ({ status: 200, body: { data: [] } }),
      'POST /api/admin/relations': (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          sourceTable: 'bestellungen',
          sourceColumn: 'kundennr',
          targetTable: 'kunden',
          targetColumn: 'id',
        });
        return { status: 200, body: { data: relations[0] } };
      },
    });
    renderOpen();
    fireEvent.click(screen.getByRole('tab', { name: 'Beziehungen' }));
    fireEvent.change(screen.getByLabelText('Von Tabelle'), { target: { value: 'bestellungen' } });
    fireEvent.change(screen.getByLabelText('Von Spalte'), { target: { value: 'kundennr' } });
    fireEvent.change(screen.getByLabelText('Nach Tabelle'), { target: { value: 'kunden' } });
    fireEvent.change(screen.getByLabelText('Nach Spalte'), { target: { value: 'id' } });
    const button = await screen.findByRole('button', { name: 'Beziehung erstellen' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/relations',
        expect.objectContaining({ method: 'POST' })
      )
    );
    await waitFor(() =>
      expect(screen.getByText('Beziehung angelegt.')).toHaveClass('alert-success')
    );
    expect((screen.getByLabelText('Von Tabelle') as HTMLInputElement).value).toBe('');
  });

  it('deletes a relation when confirmed', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    const fetchMock = setupFetch({
      'GET /api/admin/relations': () => ({ status: 200, body: { data: relations } }),
      'DELETE /api/admin/relations/fk_bestellungen_kunden': () => ({
        status: 200,
        body: { data: { constraint: 'fk_bestellungen_kunden' } },
      }),
    });
    renderOpen();
    fireEvent.click(screen.getByRole('tab', { name: 'Beziehungen' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Beziehung fk_bestellungen_kunden löschen' })
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/relations/fk_bestellungen_kunden',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    await waitFor(() =>
      expect(screen.getByText('Beziehung gelöscht.')).toHaveClass('alert-success')
    );
  });
});
