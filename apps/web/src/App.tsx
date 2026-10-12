import { Chat } from './components/Chat';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Chat App</h1>
        <p>Mock-Chat · Keyword-Antworten der Express-API · TypeScript + React</p>
      </header>

      <section className="card chat-card" aria-label="Chat">
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
