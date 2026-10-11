import { useEffect, useState } from 'react';
import type { ApiResponse, Todo } from 'shared';

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL ?? '';
    fetch(`${apiBase}/api/todos`)
      .then((res) => res.json())
      .then((json: ApiResponse<Todo[]>) => setTodos(json.data))
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