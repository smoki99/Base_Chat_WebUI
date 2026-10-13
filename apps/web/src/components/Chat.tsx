import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { Markdown } from './Markdown';

/**
 * Chat UI: message list + composer. Reuses the existing Material Design
 * classes (card, btn, form-control, skeleton, empty/error states) so the
 * chat stays consistent with the app shell. Assistant & user messages are
 * rendered as Markdown (tables, lists, code) via the `Markdown` component.
 */
export function Chat() {
  const { messages, input, setInput, isLoading, error, send } = useChat();
  const canSend = input.trim().length > 0 && !isLoading;
  const messagesRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view. Guarded because jsdom does not implement
  // Element.scrollTo (tests would throw); real browsers always have it.
  useEffect(() => {
    const el = messagesRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  return (
    <div className="chat">
      <div
        ref={messagesRef}
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-label="Chatnachrichten"
      >
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
            <div className="chat-text chat-md">
              <Markdown>{message.content}</Markdown>
            </div>
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
