import { useCallback, useEffect, useRef, useState } from 'react';
import { loadConversations, saveConversations, readJSON, writeJSON, getStorageError } from '../services/storageService';
import { STORAGE_KEYS } from '../utils/constants';
import { uid, titleFromMessage } from '../utils/formatters';

const makeConversation = () => ({
  id: uid(),
  threadId: uid(), // separate backend thread id, one per conversation
  title: 'New chat',
  pinned: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
});

export function useChatHistory({ saveLocally }) {
  const [conversations, setConversations] = useState(() => {
    const saved = loadConversations();
    return saved.length ? saved : [];
  });
  const [activeId, setActiveId] = useState(() => {
    const id = readJSON(STORAGE_KEYS.activeId, null);
    return id;
  });
  const [storageError, setStorageError] = useState(getStorageError());
  const timer = useRef(null);

  // Ensure there is always an active (possibly empty) conversation.
  useEffect(() => {
    const exists = conversations.some((c) => c.id === activeId);
    if (!exists) {
      const draft = makeConversation();
      setConversations((prev) => [draft, ...prev.filter((c) => c.messages.length > 0)]);
      setActiveId(draft.id);
    }
  }, [activeId, conversations]);

  // Debounced persistence (streaming updates are frequent).
  useEffect(() => {
    if (!saveLocally) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const toSave = conversations.filter((c) => c.messages.length > 0);
      saveConversations(toSave);
      writeJSON(STORAGE_KEYS.activeId, activeId);
      setStorageError(getStorageError());
    }, 400);
    return () => clearTimeout(timer.current);
  }, [conversations, activeId, saveLocally]);

  const active = conversations.find((c) => c.id === activeId) || null;

  const update = useCallback((id, fn) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)));
  }, []);

  const updateMessage = useCallback(
    (convId, msgId, fn) => update(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) })),
    [update]
  );

  const newChat = useCallback(() => {
    const draft = makeConversation();
    setConversations((prev) => [draft, ...prev.filter((c) => c.messages.length > 0)]);
    setActiveId(draft.id);
    return draft.id;
  }, []);

  const select = useCallback((id) => setActiveId(id), []);

  const rename = useCallback((id, title) => {
    const t = title.trim();
    if (t) update(id, (c) => ({ ...c, title: t.slice(0, 80) }));
  }, [update]);

  const togglePin = useCallback((id) => update(id, (c) => ({ ...c, pinned: !c.pinned })), [update]);

  const remove = useCallback((id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const clearAll = useCallback(() => {
    setConversations([]);
    setActiveId(null);
    writeJSON(STORAGE_KEYS.conversations, []);
  }, []);

  const addTurn = useCallback((convId, userMsg, assistantMsg, { replaceFromIndex } = {}) => {
    update(convId, (c) => {
      const base = typeof replaceFromIndex === 'number' ? c.messages.slice(0, replaceFromIndex) : c.messages;
      const isFirst = !c.messages.some((m) => m.role === 'user');
      const msgs = userMsg ? [...base, userMsg, assistantMsg] : [...base, assistantMsg];
      return { ...c, title: isFirst && userMsg ? titleFromMessage(userMsg.content) : c.title, messages: msgs };
    });
  }, [update]);

  return { conversations, active, activeId, update, updateMessage, newChat, select, rename, togglePin, remove, clearAll, addTurn, storageError };
}
