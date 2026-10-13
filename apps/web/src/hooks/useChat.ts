import { useCallback, useState } from 'react';
import type { ChatHistoryMessage, ChatMessage as WireChatMessage } from 'shared';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'sending' | 'sent' | 'error';
}

interface ChatApiResponse {
  data?: WireChatMessage;
  error?: { message: string };
}

const FALLBACK_MESSAGE = 'Der Server ist nicht erreichbar. Bitte versuche es später erneut.';
const MAX_CONTEXT_MESSAGES = Number(import.meta.env.VITE_CONTEXT_MESSAGES) || 20;

interface UseChatOptions {
  /** Initial messages (e.g. restored from history). */
  initialMessages?: ChatMessage[];
  /** Stable chat ID for history persistence. */
  chatId?: string | null;
  /** Callback to notify the history hook when messages change. */
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

/**
 * Chat state + logic. Talks to the existing `/api/chat` endpoint and keeps
 * the local message list. Swapping the backend later only touches `fetchChat`.
 */
export function useChat(options: UseChatOptions = {}) {
  const { initialMessages = [], chatId, onMessagesChange } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notify parent when messages change (for auto-save to history).
  const updateMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        onMessagesChange?.(next);
        return next;
      });
    },
    [onMessagesChange]
  );

  const send = useCallback(
    async (overrideText?: string) => {
      const content = (overrideText ?? input).trim();
      if (!content || isLoading) return;

      const messageId = crypto.randomUUID();
      setError(null);
      // Optimistic: user message appears immediately with "sending" status
      updateMessages((prev) => [
        ...prev,
        { id: messageId, role: 'user', content, status: 'sending' },
      ]);
      setInput('');
      setIsLoading(true);

      try {
        // Build history from previous sent messages
        const history: ChatHistoryMessage[] = messages
          .filter((m) => m.status === 'sent')
          .slice(-MAX_CONTEXT_MESSAGES)
          .map((m) => ({ role: m.role, content: m.content }));

        const reply = await fetchChat(content, history);
        // Mark user message as sent, append the assistant reply
        updateMessages((prev) =>
          prev
            .map((msg) => (msg.id === messageId ? { ...msg, status: 'sent' as const } : msg))
            .concat({
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: reply,
              status: 'sent' as const,
            })
        );
      } catch (err) {
        // Mark the user message as failed and surface the error
        updateMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'error' as const } : msg))
        );
        setError(err instanceof Error ? err.message : FALLBACK_MESSAGE);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, updateMessages]
  );

  /** Replace all messages (used when restoring a chat from history). */
  const replaceMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    setError(null);
  }, []);

  return { messages, input, setInput, isLoading, error, send, replaceMessages, chatId };
}

async function fetchChat(message: string, history: ChatHistoryMessage[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  const payload = (await res.json()) as ChatApiResponse;
  if (!res.ok || !payload?.data) {
    throw new Error(payload?.error?.message ?? FALLBACK_MESSAGE);
  }
  return payload.data.content;
}
