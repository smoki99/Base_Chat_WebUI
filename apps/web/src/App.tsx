import { Chat } from './components/Chat';
import TodoList from './components/TodoList';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Todo App</h1>
        <p>Todos + Mock-Chat · Keyword-Antworten der Express-API · TypeScript + React</p>
      </header>

      <TodoList />

      <section className="card todo-card" aria-label="Chat">
        <div className="card-body">
          <Chat />
        </div>
      </section>

      <footer className="app-footer">
        Boilerplate · Express-API + React 19 · Unit- &amp; E2E-getestet
      </footer>
    </div>
  );
}
