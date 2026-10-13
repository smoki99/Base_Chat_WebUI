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

/**
 * Chat state + logic. Talks to the existing `/api/chat` endpoint and keeps
 * the local message list. Swapping the backend later only touches `fetchChat`.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    const messageId = crypto.randomUUID();
    setError(null);
    // Optimistic: user message appears immediately with "sending" status
    setMessages((prev) => [...prev, { id: messageId, role: 'user', content, status: 'sending' }]);
    setInput('');
    setIsLoading(true);

    try {
      // Build history from previous sent messages (exclude the one just added above)
      const history: ChatHistoryMessage[] = messages
        .filter((m) => m.status === 'sent')
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content }));

      const reply = await fetchChat(content, history);
      // Mark user message as sent, append the assistant reply
      setMessages((prev) =>
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
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'error' as const } : msg))
      );
      setError(err instanceof Error ? err.message : FALLBACK_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return { messages, input, setInput, isLoading, error, send };
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
