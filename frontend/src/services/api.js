// Central place for API URL construction. Every request uses this base URL.
export const API_BASE = String(import.meta.env.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export const ENDPOINTS = {
  root: '/',
  health: '/health',
  chatStream: '/api/chat/stream', // POST {message, thread_id} -> SSE
  tts: '/tts', // POST {text, voice, rate, volume} -> audio/mpeg
  ttsVoices: '/tts/available_voices', // GET
  stt: '/stt', // POST multipart field "file_path"; query translation, language_detection
  sttLanguages: '/stt/supported_languages', // GET
  knowledgeBaseDocuments: '/api/knowledge-base/documents',
  knowledgeBaseUpload: '/api/knowledge-base/upload',
};

export const apiUrl = (path) => `${API_BASE}${path}`;

export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http', hint = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind; // 'network' | 'http' | 'abort'
    this.hint = hint;
  }
}

/** Read a FastAPI error body ({detail: string | [{msg}]}) safely. */
export async function readErrorDetail(response) {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail)) return body.detail.map((d) => d.msg).filter(Boolean).join('; ');
  } catch {
    /* body was not JSON */
  }
  return `Request failed with status ${response.status}.`;
}

/** fetch wrapper that converts network failures into ApiError with a friendly message. */
export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(apiUrl(path), options);
  } catch (err) {
    if (err?.name === 'AbortError') throw new ApiError('Request cancelled.', { kind: 'abort' });
    throw new ApiError('Unable to connect to the backend. Check that the API server is running.', {
      kind: 'network',
      hint: `Expected at ${API_BASE}`,
    });
  }
  if (!response.ok) {
    throw new ApiError(await readErrorDetail(response), { status: response.status });
  }
  return response;
}

export async function getJSON(path, signal) {
  const res = await request(path, { signal });
  return res.json();
}

/** Returns {ok, error?} for GET /health. */
export async function checkHealth() {
  try {
    const data = await getJSON(ENDPOINTS.health);
    return { ok: data?.status === 'ok' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
