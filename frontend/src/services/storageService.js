import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../utils/constants';
import { uid } from '../utils/formatters';

let lastError = null;
let fallbackKnowledgeBaseUserId = '';
export const getStorageError = () => lastError;

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (err) {
    lastError = 'Local storage is unavailable or contains unreadable data.';
    return fallback;
  }
}

/** Returns true on success. On quota/unavailable errors returns false and records the message. */
export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    lastError = null;
    return true;
  } catch (err) {
    lastError =
      err?.name === 'QuotaExceededError'
        ? 'Local storage is full. Delete some conversations to keep saving history.'
        : 'Local storage is unavailable. Your chats will not be saved on this device.';
    return false;
  }
}

export function removeKeys(keys) {
  try {
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export const loadProfile = () => {
  const p = readJSON(STORAGE_KEYS.profile, null);
  return p && typeof p === 'object' ? { name: String(p.name || ''), onboarded: !!p.onboarded } : { name: '', onboarded: false };
};
export const saveProfile = (profile) => writeJSON(STORAGE_KEYS.profile, profile);

export const loadSettings = () => {
  const s = readJSON(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
};
export const saveSettings = (settings) => writeJSON(STORAGE_KEYS.settings, settings);

export function loadKnowledgeBaseUserId() {
  const saved = readJSON(STORAGE_KEYS.knowledgeBaseUser, null);
  if (typeof saved === 'string' && saved) return saved;
  if (fallbackKnowledgeBaseUserId) return fallbackKnowledgeBaseUserId;
  fallbackKnowledgeBaseUserId = uid();
  writeJSON(STORAGE_KEYS.knowledgeBaseUser, fallbackKnowledgeBaseUserId);
  return fallbackKnowledgeBaseUserId;
}

export function resetKnowledgeBaseUserId() {
  fallbackKnowledgeBaseUserId = uid();
  writeJSON(STORAGE_KEYS.knowledgeBaseUser, fallbackKnowledgeBaseUserId);
  return fallbackKnowledgeBaseUserId;
}

/** Validate saved conversations; invalid entries are skipped, interrupted streams are marked stopped. */
export function loadConversations() {
  const raw = readJSON(STORAGE_KEYS.conversations, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.id === 'string' && typeof c.threadId === 'string' && Array.isArray(c.messages))
    .map((c) => ({
      id: c.id,
      threadId: c.threadId,
      title: typeof c.title === 'string' && c.title ? c.title : 'New chat',
      pinned: !!c.pinned,
      createdAt: c.createdAt || Date.now(),
      updatedAt: c.updatedAt || Date.now(),
      messages: c.messages
        .filter((m) => m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => (m.status === 'streaming' ? { ...m, status: 'stopped' } : m)),
    }));
}
export const saveConversations = (list) => writeJSON(STORAGE_KEYS.conversations, list);
