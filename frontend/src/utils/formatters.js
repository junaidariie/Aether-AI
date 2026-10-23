import { AGENT_LABELS, TOOL_META } from './constants';

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function prettify(name = '') {
  return (
    String(name)
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown'
  );
}

export const agentLabel = (name) => AGENT_LABELS[name] || prettify(name);
export const toolMeta = (name) => TOOL_META[name] || { label: prettify(name), category: 'other' };

export function greetingFor(name, date = new Date()) {
  const clean = (name || '').trim();
  if (!clean) return 'Hello! What would you like to explore?';
  const h = date.getHours();
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${clean}.`;
}

export function truncate(text, max = 40) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export const titleFromMessage = (text) => truncate(text, 48) || 'New chat';

export function safeUrl(value) {
  try {
    const u = new URL(String(value ?? '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Remove Markdown syntax so text-to-speech doesn't read symbols aloud. */
export function stripMarkdown(md = '') {
  return String(md)
    .replace(/```[\s\S]*?```/g, ' (code block omitted) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function speedToRate(speed) {
  const pct = Math.round((Number(speed) - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`; // edge-tts format, e.g. "+25%"
}
