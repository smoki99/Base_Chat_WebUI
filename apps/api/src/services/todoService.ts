/** Todo domain logic – in-memory for now. */
import type { Todo } from 'shared';

const todos: Todo[] = [
  { id: 1, title: 'Learn TypeScript', done: true },
  { id: 2, title: 'Build an API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

export function getTodos(): Todo[] {
  return [...todos];
}