import { useState } from 'react';
import type { StoredChat } from '../hooks/useChatHistory';

interface SidebarProps {
  chats: StoredChat[];
  activeChatId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** Opens the settings dialog (voice + language). */
  onOpenSettings: () => void;
  /** Called after any action to close the sidebar (mobile). */
  onClose?: () => void;
  /** Custom logo (PNG/SVG data URL) shown in the sidebar header, or `null`. */
  logo?: string | null;
}

/** Format a timestamp as a short relative label. */
function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'jetzt';
  if (min < 60) return `vor ${min} Min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function Sidebar({
  chats,
  activeChatId,
  onNew,
  onSelect,
  onDelete,
  onRename,
  onOpenSettings,
  onClose,
  logo = null,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function handleRenameStart(id: string, currentTitle: string) {
    setEditingId(id);
    setEditValue(currentTitle);
  }

  function handleRenameSave(id: string) {
    const trimmed = editValue.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setEditingId(null);
  }

  function handleSelect(id: string) {
    onSelect(id);
    onClose?.();
  }

  function handleNew() {
    onNew();
    onClose?.();
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    onDelete(id);
  }

  return (
    <aside className="sidebar" role="complementary" aria-label="Chatverlauf">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          {logo && <img className="sidebar-logo" src={logo} alt="Logo" />}
          <span className="sidebar-title">Chat</span>
        </div>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-icon-btn"
            onClick={onOpenSettings}
            aria-label="Einstellungen"
            title="Einstellungen"
          >
            ⚙️
          </button>
          <button className="sidebar-new-btn" onClick={handleNew} aria-label="Neue Unterhaltung">
            + Neue
          </button>
        </div>
      </div>

      <nav className="sidebar-list" role="list">
        {chats.length === 0 && <p className="sidebar-empty">Noch keine Unterhaltungen</p>}
        {chats.map((chat) => (
          <div
            key={chat.id}
            role="listitem"
            className={`sidebar-item${chat.id === activeChatId ? ' sidebar-item--active' : ''}`}
            onClick={() => handleSelect(chat.id)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect(chat.id);
            }}
          >
            {editingId === chat.id ? (
              <input
                className="sidebar-edit-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRenameSave(chat.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSave(chat.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
                aria-label="Titel bearbeiten"
              />
            ) : (
              <div
                className="sidebar-item-content"
                onDoubleClick={() => handleRenameStart(chat.id, chat.title)}
              >
                <span className="sidebar-item-title">{chat.title}</span>
                <span className="sidebar-item-time">{formatTime(chat.updatedAt)}</span>
              </div>
            )}
            <button
              className="sidebar-item-delete"
              onClick={(e) => handleDelete(e, chat.id)}
              aria-label={`Chat "${chat.title}" löschen`}
              title="Löschen"
            >
              ×
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
