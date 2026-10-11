/** Todo domain logic – in-memory for now. */
import type { CreateTodo, Todo, UpdateTodo } from 'shared';

const todos: Todo[] = [
  { id: 1, title: 'Learn TypeScript', done: true },
  { id: 2, title: 'Build an API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

let nextId = todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;

export function getTodos(): Todo[] {
  return [...todos];
}

export function createTodo(input: CreateTodo): Todo {
  const todo: Todo = { id: nextId++, title: input.title.trim(), done: false };
  todos.push(todo);
  return { ...todo };
}

export function updateTodo(id: number, input: UpdateTodo): Todo | undefined {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return undefined;
  if (input.title !== undefined) todo.title = input.title.trim();
  if (input.done !== undefined) todo.done = input.done;
  return { ...todo };
}

export function deleteTodo(id: number): boolean {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  todos.splice(idx, 1);
  return true;
}