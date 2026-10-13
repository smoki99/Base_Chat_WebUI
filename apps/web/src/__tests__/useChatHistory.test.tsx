import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatHistory } from '../hooks/useChatHistory';
import type { ChatMessage } from '../hooks/useChat';

function makeMessage(id: string, role: 'user' | 'assistant', content: string): ChatMessage {
  return { id, role, content, status: 'sent' };
}

describe('useChatHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty chats and no active chat', () => {
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.chats).toEqual([]);
    expect(result.current.activeChatId).toBeNull();
    expect(result.current.activeMessages).toEqual([]);
  });

  it('newChat generates a fresh ID', () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.newChat();
    });
    expect(result.current.activeChatId).toBeTruthy();
    expect(result.current.activeMessages).toEqual([]);
  });

  it('saves a chat and it appears in the list', () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.newChat();
    });
    const chatId = result.current.activeChatId!;
    const messages = [makeMessage('1', 'user', 'Hallo'), makeMessage('2', 'assistant', 'Hi!')];
    act(() => {
      result.current.scheduleSave(chatId, 'Hallo', messages);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.chats).toHaveLength(1);
    expect(result.current.chats[0]!.id).toBe(chatId);
    expect(result.current.chats[0]!.title).toBe('Hallo');
  });

  it('openChat restores messages', () => {
    const chatId = 'test-id-1';
    const messages = [makeMessage('1', 'user', 'Hi'), makeMessage('2', 'assistant', 'Hello')];
    localStorage.setItem(
      'chat-history',
      JSON.stringify([{ id: chatId, title: 'Hi', updatedAt: Date.now(), messages }])
    );
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.openChat(chatId);
    });
    expect(result.current.activeChatId).toBe(chatId);
    expect(result.current.activeMessages).toEqual(messages);
  });

  it('limits stored chats to 20', () => {
    const chats = Array.from({ length: 25 }, (_, i) => ({
      id: `chat-${i}`,
      title: `Chat ${i}`,
      updatedAt: Date.now() - i * 1000,
      messages: [makeMessage('1', 'user', 'x')],
    }));
    localStorage.setItem('chat-history', JSON.stringify(chats));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.chats).toHaveLength(20);
  });

  it('deleteChat removes the chat from the list', () => {
    const chatId = 'del-id';
    localStorage.setItem(
      'chat-history',
      JSON.stringify([{ id: chatId, title: 'T', updatedAt: Date.now(), messages: [] }])
    );
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.deleteChat(chatId);
    });
    expect(result.current.chats).toHaveLength(0);
  });

  it('deleteChat clears active state if deleting the active chat', () => {
    const chatId = 'active-del';
    const messages = [makeMessage('1', 'user', 'x')];
    localStorage.setItem(
      'chat-history',
      JSON.stringify([{ id: chatId, title: 'T', updatedAt: Date.now(), messages }])
    );
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.openChat(chatId);
    });
    act(() => {
      result.current.deleteChat(chatId);
    });
    expect(result.current.activeChatId).toBeNull();
    expect(result.current.activeMessages).toEqual([]);
  });

  it('renameChat updates the title', () => {
    const chatId = 'rename-id';
    localStorage.setItem(
      'chat-history',
      JSON.stringify([{ id: chatId, title: 'Old', updatedAt: Date.now(), messages: [] }])
    );
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.renameChat(chatId, 'New Title');
    });
    expect(result.current.chats[0]!.title).toBe('New Title');
  });

  it('moves a chat to the front when saved again', () => {
    const chats = [
      { id: 'old', title: 'Old', updatedAt: 1000, messages: [] },
      { id: 'new', title: 'New', updatedAt: 2000, messages: [] },
    ];
    localStorage.setItem('chat-history', JSON.stringify(chats));
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.scheduleSave('old', 'Old', []);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.chats[0]!.id).toBe('old');
    expect(result.current.chats[1]!.id).toBe('new');
  });

  it('persists to localStorage on change', () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      result.current.newChat();
    });
    const chatId = result.current.activeChatId!;
    const messages = [makeMessage('1', 'user', 'Test')];
    act(() => {
      result.current.scheduleSave(chatId, 'Test', messages);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const stored = JSON.parse(localStorage.getItem('chat-history')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(chatId);
  });

  it('gracefully handles corrupt localStorage', () => {
    localStorage.setItem('chat-history', 'not-valid-json{{{');
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.chats).toEqual([]);
  });
});
