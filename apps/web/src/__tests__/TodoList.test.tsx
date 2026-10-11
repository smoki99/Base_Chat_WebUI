import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodoList from '../components/TodoList';

const mockTodos = [
  { id: 1, title: 'Learn TypeScript', done: true },
  { id: 2, title: 'Build an API', done: false },
];

function ok(body: unknown, status = 200) {
  return { ok: true, status, json: () => Promise.resolve(body) };
}

describe('TodoList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders the todo list with fetched items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: mockTodos })));

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByTestId('todo-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Learn TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Build an API')).toBeInTheDocument();
    expect(screen.getByTestId('todo-1')).toBeInTheDocument();
    expect(screen.getByTestId('todo-2')).toBeInTheDocument();
  });

  it('shows the API error state with retry button when the response is an ApiError (regression)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Something went wrong' } }),
      }),
    );

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /erneut versuchen/i })).toBeInTheDocument();
    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });

  it('shows a status-based error state with retry button when response is not ok (regression)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) }),
    );

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/503/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /erneut versuchen/i })).toBeInTheDocument();
    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });

  it('shows a skeleton while loading', async () => {
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })),
    );

    const { container } = render(<TodoList />);

    // Skeleton is visible while fetch is pending
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton-bar')).toHaveLength(3);

    // Resolve fetch to finish loading
    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ data: mockTodos }) });
    await screen.findByTestId('todo-list');
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no todos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: [] })));

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/keine todos/i)).toBeInTheDocument();
    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });

  it('shows a success toast after adding a todo', async () => {
    const created = { id: 99, title: 'Ship it', done: false };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return ok({ data: created }, 201);
        return ok({ data: mockTodos });
      }),
    );

    render(<TodoList />);
    await screen.findByTestId('todo-list');

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /new todo/i }), 'Ship it');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await screen.findByTestId('toast');
    expect(screen.getByTestId('toast')).toHaveTextContent(/hinzugefügt/i);
    expect(screen.getByTestId('toast')).toHaveClass('toast-success');
  });

  it('shows a success toast after deleting a todo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        if (init?.method === 'DELETE') return { ok: true, status: 204, json: () => Promise.resolve({}) };
        return ok({ data: mockTodos });
      }),
    );

    render(<TodoList />);
    await screen.findByTestId('todo-list');

    const user = userEvent.setup();
    await user.click(within(screen.getByTestId('todo-2')).getByRole('button', { name: /delete/i }));

    await screen.findByTestId('toast');
    expect(screen.getByTestId('toast')).toHaveTextContent(/gelöscht/i);
  });

  it('calls fetch again when retry button is clicked in error state', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Server down' } }),
      })
      .mockResolvedValueOnce(ok({ data: mockTodos }));
    vi.stubGlobal('fetch', fetchMock);

    render(<TodoList />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    // Click retry
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /erneut versuchen/i }));

    // Should now show the list
    await screen.findByTestId('todo-list');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('adds a new todo via POST and shows it in the list', async () => {
    const created = { id: 99, title: 'Ship it', done: false };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        if (init?.method === 'POST') return ok({ data: created }, 201);
        return ok({ data: mockTodos });
      }),
    );

    render(<TodoList />);
    await screen.findByTestId('todo-list');

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /new todo/i }), 'Ship it');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await screen.findByText('Ship it');
    expect(screen.getByRole('textbox', { name: /new todo/i })).toHaveValue('');
  });

  it('toggles a todo via PATCH and reflects the state', async () => {
    const item = { id: 2, title: 'Build an API', done: false };
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === 'PATCH') return ok({ data: { ...item, done: true } });
      return ok({ data: [item] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TodoList />);
    const checkbox = await screen.findByRole('checkbox', { name: /build an api/i });

    const user = userEvent.setup();
    await user.click(checkbox);

    await waitFor(() => expect(checkbox).toBeChecked());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/todos/2'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('deletes a todo via DELETE and removes it from the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        if (init?.method === 'DELETE') return { ok: true, status: 204, json: () => Promise.resolve({}) };
        return ok({ data: mockTodos });
      }),
    );

    render(<TodoList />);
    await screen.findByTestId('todo-list');

    const user = userEvent.setup();
    await user.click(within(screen.getByTestId('todo-2')).getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(screen.queryByTestId('todo-2')).not.toBeInTheDocument());
    expect(screen.getByTestId('todo-1')).toBeInTheDocument();
  });
});