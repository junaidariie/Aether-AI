/**
 * Incremental Server-Sent Events parser for fetch() ReadableStreams.
 * Handles partial chunks, multiple events per chunk, CRLF, multi-line data,
 * UTF-8 split across chunks (TextDecoder stream mode) and invalid JSON.
 */
export function createSSEParser(onEvent) {
  let buffer = '';

  const dispatch = (block) => {
    if (!block.trim()) return;
    let event = 'message';
    const dataLines = [];
    for (const rawLine of block.split('\n')) {
      if (!rawLine || rawLine.startsWith(':')) continue; // comment / keep-alive
      const idx = rawLine.indexOf(':');
      const field = idx === -1 ? rawLine : rawLine.slice(0, idx);
      let value = idx === -1 ? '' : rawLine.slice(idx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') dataLines.push(value);
    }
    if (!dataLines.length) return;
    const raw = dataLines.join('\n');
    let data = null;
    let parseError = null;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      parseError = err;
    }
    onEvent({ event, data, raw, parseError });
  };

  return {
    push(text) {
      buffer += text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        dispatch(block);
      }
    },
    flush() {
      if (buffer.trim()) dispatch(buffer);
      buffer = '';
    },
  };
}

/** Read a fetch Response body as SSE. Resolves when the stream closes. */
export async function readSSE(response, onEvent, signal) {
  if (!response.body) throw new Error('The response has no readable body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parser = createSSEParser(onEvent);
  const onAbort = () => reader.cancel().catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.flush();
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
