import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import type { StoredChat } from '../hooks/useChatHistory';

function makeChat(id: string, title: string): StoredChat {
  return { id, title, updatedAt: Date.now(), messages: [] };
}

const baseProps = {
  chats: [makeChat('1', 'Erster Chat'), makeChat('2', 'Zweiter Chat')],
  activeChatId: '1' as string | null,
  onNew: vi.fn(),
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
};

describe('Sidebar', () => {
  it('renders the chat list', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByText('Erster Chat')).toBeInTheDocument();
    expect(screen.getByText('Zweiter Chat')).toBeInTheDocument();
  });

  it('shows empty state when no chats', () => {
    render(<Sidebar {...baseProps} chats={[]} />);
    expect(screen.getByText('Noch keine Unterhaltungen')).toBeInTheDocument();
  });

  it('highlights the active chat', () => {
    render(<Sidebar {...baseProps} />);
    const items = document.querySelectorAll('.sidebar-item');
    expect(items[0]).toHaveClass('sidebar-item--active');
    expect(items[1]).not.toHaveClass('sidebar-item--active');
  });

  it('calls onSelect when a chat is clicked', () => {
    const onSelect = vi.fn();
    render(<Sidebar {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Zweiter Chat'));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('calls onNew when the new button is clicked', () => {
    const onNew = vi.fn();
    render(<Sidebar {...baseProps} onNew={onNew} />);
    fireEvent.click(screen.getByText('+ Neue'));
    expect(onNew).toHaveBeenCalled();
  });

  it('calls onDelete when the delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<Sidebar {...baseProps} onDelete={onDelete} />);
    const deleteBtn = screen.getByLabelText('Chat "Erster Chat" l\u00f6schen');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('calls onClose after selection', () => {
    const onClose = vi.fn();
    render(<Sidebar {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Erster Chat'));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows renaming via double-click', () => {
    const onRename = vi.fn();
    render(<Sidebar {...baseProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText('Erster Chat'));
    const input = screen.getByLabelText('Titel bearbeiten');
    fireEvent.change(input, { target: { value: 'Neuer Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('1', 'Neuer Name');
  });
});
