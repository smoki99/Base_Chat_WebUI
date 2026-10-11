import { useEffect, useState } from 'react';
import { isApiError } from 'shared';
import type { ApiResult, Todo } from 'shared';

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL ?? '';
    fetch(`${apiBase}/api/todos`)
      .then(async (res) => {
        const json = (await res.json()) as ApiResult<Todo[]>;
        if (isApiError(json)) {
          throw new Error(json.error.message);
        }
        if (!res.ok || !Array.isArray(json.data)) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        setTodos(json.data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul data-testid="todo-list">
      {todos.map((todo) => (
        <li key={todo.id} data-testid={`todo-${todo.id}`}>
          {todo.title}
        </li>
      ))}
    </ul>
  );
}