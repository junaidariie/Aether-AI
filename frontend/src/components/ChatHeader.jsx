import { Menu, MessageSquarePlus } from 'lucide-react';

export default function ChatHeader({ title, onOpenSidebar, onNewChat }) {
  return (
    <header className="chat-header">
      <button className="icon-btn mobile-only" onClick={onOpenSidebar} aria-label="Open sidebar"><Menu size={22} /></button>
      <h1 className="chat-title">{title || 'Aether AI'}</h1>
      <button className="header-new-chat" onClick={onNewChat}>
        <MessageSquarePlus size={17} aria-hidden="true" />
        <span>New chat</span>
      </button>
    </header>
  );
}
