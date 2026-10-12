import { useCallback, useState } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatApiResponse {
  data?: { id: string; content: string };
  error?: { message: string };
}

const FALLBACK_MESSAGE = 'Der Server ist nicht erreichbar. Bitte versuche es später erneut.';

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

    setError(null);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await fetchChat(content);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  return { messages, input, setInput, isLoading, error, send };
}

async function fetchChat(message: string): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const payload = (await res.json()) as ChatApiResponse;
  if (!res.ok || !payload?.data) {
    throw new Error(payload?.error?.message ?? FALLBACK_MESSAGE);
  }
  return payload.data.content;
}
