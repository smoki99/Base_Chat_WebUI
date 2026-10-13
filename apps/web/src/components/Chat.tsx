import { useEffect, useRef } from 'react';
import { useChat, type ChatMessage } from '../hooks/useChat';
import { useVoice } from '../hooks/useVoice';
import { Markdown } from './Markdown';
import acknowledgments from '../data/acknowledgments.json';

/** Delimiter that the LLM appends before the spoken summary. */
const VOICE_SUMMARY_MARKER = '<!-- VOICE_SUMMARY: -->';

/** Fallback phrases when the LLM omits the voice summary section. */
const SPEECH_FALLBACK: Record<string, string> = {
  de: 'Hier die Zusammenfassung!',
  en: "Here's the summary!",
  es: '¡Aquí tienes el resumen!',
};

/** Pick a random acknowledgment phrase for the given language code. */
function pickAcknowledgment(lang: string): string {
  const map: Record<string, string[]> = acknowledgments;
  const phrases = map[lang] ?? map.de ?? [];
  // eslint-disable-next-line sonarjs/pseudo-random -- UI-only, not security-sensitive
  const idx = Math.floor(Math.random() * phrases.length);
  return phrases[idx] ?? 'Einen Moment…';
}

/**
 * Split an LLM response into the on-screen part and the spoken part.
 * The LLM is instructed to end with `<!-- VOICE_SUMMARY: -->` followed
 * by a short conversational summary. If the marker is absent the entire
 * text is the screen part and the speech part is empty (caller uses
 * a language-specific fallback phrase).
 */
function splitForSpeech(text: string): { screen: string; speech: string } {
  const idx = text.indexOf(VOICE_SUMMARY_MARKER);
  if (idx === -1) return { screen: text, speech: '' };
  return {
    screen: text.slice(0, idx).trimEnd(),
    speech: text.slice(idx + VOICE_SUMMARY_MARKER.length).trim(),
  };
}

interface ChatProps {
  initialMessages?: ChatMessage[];
  chatId?: string | null;
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

/**
 * Chat UI: message list + composer. Full-height layout for use inside
 * the two-column app shell. Assistant & user messages are rendered as
 * Markdown (tables, lists, code) via the `Markdown` component.
 */
export function Chat({ initialMessages = [], chatId = null, onMessagesChange }: ChatProps) {
  const { messages, input, setInput, isLoading, error, send } = useChat({
    initialMessages,
    chatId,
    onMessagesChange,
  });
  const voice = useVoice();
  const canSend = input.trim().length > 0 && !isLoading;
  const messagesRef = useRef<HTMLDivElement>(null);
  // Guard: prevents React StrictMode (dev) double-effect from calling
  // speak() + send() twice for the same transcript.
  const processedTranscriptRef = useRef<string | null>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = messagesRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // When a STT transcript arrives, handle it exactly once.
  useEffect(() => {
    if (!voice.lastTranscript || voice.interactiveState === 'processing') return;
    const transcript = voice.lastTranscript;

    // StrictMode guard: skip if we already processed this exact transcript.
    if (processedTranscriptRef.current === transcript) return;
    processedTranscriptRef.current = transcript;

    voice.clearTranscript();

    // Minimum transcript length: discard noise transcriptions (< 3 chars)
    if (transcript.trim().length < 3) return;

    if (voice.interactiveState !== 'off') {
      console.log('[chat] sending to LLM:', JSON.stringify(transcript));
      if (voice.isTtsAvailable) {
        void voice.speak(pickAcknowledgment(voice.currentLanguage));
      }
      void send(transcript);
    } else {
      setInput((prev) => (prev ? prev + ' ' : '') + transcript);
    }
  }, [
    voice.lastTranscript,
    voice.interactiveState,
    voice.isTtsAvailable,
    voice.currentLanguage,
    voice,
    setInput,
    send,
  ]);

  // Auto-TTS: when a new assistant message arrives in interactive mode,
  // read the voice summary (or a language-specific fallback) aloud.
  const spokenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (voice.interactiveState === 'off' || !voice.isTtsAvailable) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return;
    if (spokenIdsRef.current.has(lastAssistant.id)) return;
    spokenIdsRef.current.add(lastAssistant.id);
    const { speech } = splitForSpeech(lastAssistant.content);
    const fallback = SPEECH_FALLBACK[voice.currentLanguage] ?? 'Hier die Zusammenfassung!';
    const text = speech || fallback;
    void voice.speak(text);
  }, [messages, voice.interactiveState, voice.isTtsAvailable, voice.currentLanguage, voice.speak]);

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
              {message.role === 'assistant' && voice.isTtsAvailable && (
                <button
                  className="btn btn-voice"
                  type="button"
                  aria-label={voice.isSpeaking ? 'Abbrechen' : 'Vorlesen'}
                  onClick={() => {
                    if (voice.isSpeaking) {
                      voice.stopSpeaking();
                    } else {
                      void voice.speak(message.content);
                    }
                  }}
                >
                  {voice.isSpeaking ? '⏹' : '🔊'}
                </button>
              )}
            </span>
            <div className="chat-text chat-md">
              <Markdown>{splitForSpeech(message.content).screen}</Markdown>
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
          placeholder={
            voice.interactiveState !== 'off'
              ? 'Hands-free aktiv – einfach sprechen …'
              : 'Nachricht eingeben …'
          }
          aria-label="Nachricht"
          disabled={isLoading}
        />
        {voice.isSttAvailable && voice.interactiveState === 'off' && (
          <button
            className={`btn btn-voice${voice.isRecording ? ' btn-voice--recording' : ''}`}
            type="button"
            aria-label={voice.isRecording ? 'Aufnahme stoppen' : 'Spracheingabe'}
            onClick={() => {
              if (voice.isRecording) {
                voice.stopRecording();
              } else {
                void voice.startRecording();
              }
            }}
          >
            {voice.isRecording ? '⏹' : '🎤'}
          </button>
        )}
        {voice.isSttAvailable && (
          <button
            className={`btn btn-interactive${
              voice.interactiveState !== 'off' ? ` btn-interactive--${voice.interactiveState}` : ''
            }`}
            type="button"
            aria-label={
              voice.interactiveState === 'off'
                ? 'Hands-free Modus aktivieren'
                : 'Hands-free Modus deaktivieren'
            }
            onClick={() => voice.toggleInteractiveMode()}
          >
            🎙️
            {voice.interactiveState === 'listening' && (
              <span className="btn-interactive-dot" aria-hidden="true" />
            )}
            {voice.interactiveState === 'paused' && (
              <span className="btn-interactive-dot btn-interactive-dot--blue" aria-hidden="true" />
            )}
            {voice.interactiveState === 'recording' && (
              <span className="btn-interactive-dot btn-interactive-dot--red" aria-hidden="true" />
            )}
            {voice.interactiveState === 'processing' && (
              <span className="btn-interactive-dot btn-interactive-dot--pulse" aria-hidden="true" />
            )}
          </button>
        )}
        <button className="btn btn-primary" type="submit" disabled={!canSend}>
          Senden
        </button>
      </form>
    </div>
  );
}
