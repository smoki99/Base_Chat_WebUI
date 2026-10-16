import { useCallback, useState } from 'react';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { Sidebar } from './components/Sidebar';
import { useChatHistory } from './hooks/useChatHistory';
import type { ChatMessage } from './hooks/useChat';
import { useAppearance } from './appearance';
import { VoiceProvider } from './voice/VoiceContext';

export default function App() {
  const history = useChatHistory();
  const { banner, bannerVisible, logo } = useAppearance();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      if (messages.length === 0) return;
      // Ensure an active chat exists – create one on the first message if needed.
      const id = history.activeChatId ?? history.newChat();
      const title =
        messages.find((m) => m.role === 'user')?.content.slice(0, 50) ?? 'Neue Unterhaltung';
      history.scheduleSave(id, title, messages);
    },
    [history]
  );

  return (
    <VoiceProvider>
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
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={() => setSidebarOpen(false)}
          logo={logo}
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

          {banner && bannerVisible && <img className="app-banner" src={banner} alt="Banner" />}

          <Chat
            key={chatKey}
            initialMessages={history.activeMessages}
            chatId={history.activeChatId}
            onMessagesChange={handleMessagesChange}
            logo={logo}
          />
        </div>

        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </VoiceProvider>
  );
}
