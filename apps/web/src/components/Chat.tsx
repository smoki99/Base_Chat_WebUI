import { useChat } from '../hooks/useChat';

/**
 * Chat UI: message list + composer. Reuses the existing Material Design
 * classes (card, btn, form-control, skeleton, empty/error states) so the
 * chat stays consistent with the app shell.
 */
export function Chat() {
  const { messages, input, setInput, isLoading, error, send } = useChat();
  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="chat">
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Chatnachrichten">
        {messages.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              💬
            </div>
            <p>Starte die Unterhaltung – gib unten eine Nachricht ein.</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-msg chat-msg--${message.role}${
              message.status !== 'sent' ? ` chat-msg--${message.status}` : ''
            }`}
          >
            <span className="chat-role">
              {message.role === 'user' ? 'Du' : 'Bot'}
              {message.status === 'sending' && (
                <span className="chat-status" aria-label="Wird gesendet">
                  {' '}
                  …
                </span>
              )}
              {message.status === 'error' && (
                <span className="chat-status chat-status--error" aria-label="Sendefehler">
                  {' '}
                  ⚠
                </span>
              )}
            </span>
            <p className="chat-text">{message.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="chat-typing" aria-label="Bot schreibt">
            <span className="chat-typing-dots" aria-hidden="true">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
            <span className="chat-typing-label">Bot schreibt …</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-state" role="alert">
          <div className="error-icon" aria-hidden="true">
            ⚠️
          </div>
          <p>{error}</p>
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          className="form-control"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Nachricht eingeben …"
          aria-label="Nachricht"
          disabled={isLoading}
        />
        <button className="btn btn-primary" type="submit" disabled={!canSend}>
          Senden
        </button>
      </form>
    </div>
  );
}
