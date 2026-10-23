import { safeUrl, domainOf } from './formatters';

const FIELD_RE = /^(URL|Image|Photo page|Source|Photographer|Published|Location|Time):\s*(.*)$/i;

/**
 * Tool outputs from agents_workflow/tools.py are plain-text blocks:
 *   - Title (Publisher)
 *   URL: https://...
 *   Image: https://...   Photo page: ...   Photographer: ...   Source: ...
 * This parses only what is actually present. Nothing is invented.
 */
export function parseToolOutput(toolName, output) {
  const text = String(output ?? '');
  const blocks = text.split(/\n(?=- )/).filter((b) => b.trim().startsWith('- '));
  const items = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const head = lines[0].replace(/^-\s*/, '').trim();
    const fields = {};
    const rest = [];
    for (const line of lines.slice(1)) {
      const m = line.match(FIELD_RE);
      if (m) fields[m[1].toLowerCase()] = m[2].trim();
      else if (line.trim()) rest.push(line.trim());
    }

    const image = safeUrl(fields['image']);
    const page = safeUrl(fields['photo page']) || safeUrl(fields['url']) || safeUrl(fields['source']);
    const publisherMatch = head.match(/^(.*)\s\(([^()]+)\)$/);
    const title = publisherMatch ? publisherMatch[1] : head;
    const publisher =
      publisherMatch?.[2] || (fields['source'] && !safeUrl(fields['source']) ? fields['source'] : '');

    if (image) {
      items.push({
        kind: 'image',
        title,
        image,
        page,
        attribution: fields['photographer'] ? `Photo by ${fields['photographer']}` : '',
        domain: page ? domainOf(page) : domainOf(image),
      });
    } else if (page) {
      items.push({
        kind: 'source',
        title,
        url: page,
        domain: domainOf(page),
        publisher,
        published: fields['published'] || '',
        description: rest.join(' ').slice(0, 220),
      });
    }
  }

  const seen = new Set();
  const unique = items.filter((it) => {
    const key = it.image || it.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { toolName, items: unique };
}

/** Parse "Key: value" lines (used for the weather tools). Returns null if any line doesn't fit. */
export function parseKeyValues(output) {
  const rows = [];
  for (const line of String(output ?? '').split('\n')) {
    const m = line.match(/^([A-Za-z][A-Za-z ]{1,20}):\s*(.+)$/);
    if (!m) return null;
    rows.push([m[1], m[2]]);
  }
  return rows.length ? rows : null;
}

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

/** Split text into [{text}|{url,text}] parts so URLs can be rendered as safe links. */
export function linkify(input) {
  const text = String(input ?? '');
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const match = m[0];
    const offset = m.index;
    if (offset > last) parts.push({ text: text.slice(last, offset) });
    const trimmed = match.replace(/[.,;:!?]+$/, '');
    const ok = safeUrl(trimmed);
    parts.push(ok ? { url: ok, text: trimmed } : { text: trimmed });
    if (trimmed.length < match.length) parts.push({ text: match.slice(trimmed.length) });
    last = offset + match.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export const looksLikeToolFailure = (output) =>
  /^(.* (failed|error)\b|Add [A-Z_]+ to your \.env|Could not fetch|Location not found|Unsupported units|Provide a valid)/i.test(
    String(output ?? '').trim()
  );
