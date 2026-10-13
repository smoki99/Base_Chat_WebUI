import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './useChat';

export interface StoredChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'chat-history';
const MAX_CHATS = 20;

function loadChats(): StoredChat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChat[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CHATS) : [];
  } catch {
    return [];
  }
}

function persist(chats: StoredChat[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    // Storage full or unavailable – non-fatal.
  }
}

/**
 * Manages the chat history stored in `localStorage`.
 *
 * - Keeps at most 20 chats, newest first.
 * - Exposes the currently active chat's messages so `useChat` can restore them.
 * - Auto-saves the active chat whenever its messages change.
 */
export function useChatHistory() {
  const [chats, setChats] = useState<StoredChat[]>(loadChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const saveTimer = useRef<number | null>(null);

  // Persist chats whenever they change.
  useEffect(() => {
    persist(chats);
  }, [chats]);

  /** Start a new, empty chat (generates a fresh ID immediately). */
  const newChat = useCallback(() => {
    const id = crypto.randomUUID();
    setActiveChatId(id);
    setActiveMessages([]);
  }, []);

  /** Open an existing chat from the history. */
  const openChat = useCallback(
    (id: string) => {
      const found = chats.find((c) => c.id === id);
      if (!found) return;
      setActiveChatId(id);
      setActiveMessages(found.messages);
    },
    [chats]
  );

  /**
   * Save (or upsert) the current chat into the history list.
   * Called by the Chat component whenever messages change.
   */
  const saveCurrentChat = useCallback((id: string, title: string, messages: ChatMessage[]) => {
    setChats((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) {
        const updated: StoredChat = { id, title, updatedAt: Date.now(), messages };
        // Move to front (most recent)
        const rest = prev.filter((c) => c.id !== id);
        return [updated, ...rest].slice(0, MAX_CHATS);
      }
      return [{ id, title, updatedAt: Date.now(), messages }, ...prev].slice(0, MAX_CHATS);
    });
  }, []);

  /** Debounced save – called on every message change. */
  const scheduleSave = useCallback(
    (id: string, title: string, messages: ChatMessage[]) => {
      if (saveTimer.current !== null) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(() => {
        saveCurrentChat(id, title, messages);
      }, 500);
    },
    [saveCurrentChat]
  );

  /** Delete a chat from the history. */
  const deleteChat = useCallback(
    (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setActiveMessages([]);
      }
    },
    [activeChatId]
  );

  /** Rename a chat's title. */
  const renameChat = useCallback((id: string, title: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  return {
    chats,
    activeChatId,
    activeMessages,
    newChat,
    openChat,
    saveCurrentChat,
    scheduleSave,
    deleteChat,
    renameChat,
  };
}
