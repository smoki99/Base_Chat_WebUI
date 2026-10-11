/** Todo domain logic – in-memory for now. */

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

const todos: Todo[] = [
  { id: 1, title: 'Learn TypeScript', done: true },
  { id: 2, title: 'Build an API', done: false },
  { id: 3, title: 'Write tests', done: false },
];

export function getTodos(): Todo[] {
  return [...todos];
}