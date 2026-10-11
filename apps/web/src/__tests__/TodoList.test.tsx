import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import TodoList from '../components/TodoList';

const mockTodos = [
  { id: 1, title: 'Learn TypeScript', done: true },
  { id: 2, title: 'Build an API', done: false },
];

describe('TodoList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders the todo list with fetched items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: mockTodos }),
    }));

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'Something went wrong' } }),
    }));

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });

    // The todo list must NOT be rendered – no crash
    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });

  it('shows a status-based error when response is not ok and body has no error field (regression)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    }));

    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByText(/503/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });
});