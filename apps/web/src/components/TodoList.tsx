import { useEffect, useState } from 'react';
import { isApiError } from 'shared';
import type { ApiResult, CreateTodo, Todo, UpdateTodo } from 'shared';

export default function TodoList() {
  const apiBase = import.meta.env.VITE_API_URL ?? '';
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/todos`);
      const json = (await res.json()) as ApiResult<Todo[]>;
      if (isApiError(json)) throw new Error(json.error.message);
      if (!res.ok || !Array.isArray(json.data)) throw new Error(`Request failed with status ${res.status}`);
      setTodos(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const body: CreateTodo = { title: trimmed };
      const res = await fetch(`${apiBase}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResult<Todo>;
      if (isApiError(json)) throw new Error(json.error.message);
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setTodos((prev) => [...prev, json.data]);
      setTitle('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleToggle(todo: Todo) {
    const previous = todo.done;
    const payload: UpdateTodo = { done: !previous };
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !previous } : t)));
    try {
      const res = await fetch(`${apiBase}/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    } catch (err) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: previous } : t)));
      setError((err as Error).message);
    }
  }

  async function handleDelete(todo: Todo) {
    try {
      const res = await fetch(`${apiBase}/api/todos/${todo.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error && todos.length === 0) return <p>Error: {error}</p>;

  return (
    <div>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <form
        className="todo-add d-flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="New todo…"
          aria-label="New todo title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={title.trim() === ''}>
          Add
        </button>
      </form>

      <ul className="list-group" data-testid="todo-list">
        {todos.map((todo) => (
          <li
            key={todo.id}
            data-testid={`todo-${todo.id}`}
            className={`list-group-item d-flex align-items-center gap-2 ${todo.done ? 'is-done' : ''}`}
          >
            <input
              type="checkbox"
              className="form-check-input"
              checked={todo.done}
              aria-label={`Toggle ${todo.title}`}
              onChange={() => void handleToggle(todo)}
            />
            <span className={todo.done ? 'todo-title done' : 'todo-title'}>{todo.title}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger ms-auto"
              aria-label={`Delete ${todo.title}`}
              onClick={() => void handleDelete(todo)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}