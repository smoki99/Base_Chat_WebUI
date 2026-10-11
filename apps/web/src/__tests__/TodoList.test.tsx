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

  it('shows the API error message when the response is an ApiError (regression)', async () => {
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
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });

  it('shows a status-based error when response is not ok and body has no error field (regression)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) }),
    );

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByText(/503/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
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