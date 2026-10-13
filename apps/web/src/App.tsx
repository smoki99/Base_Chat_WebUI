import { useCallback, useState } from 'react';
import { Chat } from './components/Chat';
import { Sidebar } from './components/Sidebar';
import { useChatHistory } from './hooks/useChatHistory';
import type { ChatMessage } from './hooks/useChat';

export default function App() {
  const history = useChatHistory();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // When a chat is selected, replace the active messages in useChat.
  // We use a key to force-remount the Chat component with the restored messages.
  const [chatKey, setChatKey] = useState(0);

  const handleNew = useCallback(() => {
    history.newChat();
    setChatKey((k) => k + 1);
  }, [history.newChat]);

  const handleSelect = useCallback(
    (id: string) => {
      history.openChat(id);
      setChatKey((k) => k + 1);
    },
    [history.openChat]
  );

  const handleMessagesChange = useCallback(
    (messages: ChatMessage[]) => {
      if (history.activeChatId && messages.length > 0) {
        const title =
          messages.find((m) => m.role === 'user')?.content.slice(0, 50) ?? 'Neue Unterhaltung';
        history.scheduleSave(history.activeChatId, title, messages);
      }
    },
    [history]
  );

  return (
    <div className={`app-layout${sidebarOpen ? ' app-layout--sidebar-open' : ''}`}>
      {/* Mobile: backdrop to close sidebar */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        chats={history.chats}
        activeChatId={history.activeChatId}
        onNew={handleNew}
        onSelect={handleSelect}
        onDelete={history.deleteChat}
        onRename={history.renameChat}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="chat-panel">
        {/* Mobile: hamburger to open sidebar */}
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Menü öffnen"
        >
          ☰
        </button>

        <Chat
          key={chatKey}
          initialMessages={history.activeMessages}
          chatId={history.activeChatId}
          onMessagesChange={handleMessagesChange}
        />
      </div>
    </div>
  );
}
