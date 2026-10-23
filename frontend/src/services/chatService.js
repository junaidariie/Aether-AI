import { ENDPOINTS, request, ApiError } from './api';
import { readSSE } from '../utils/parseSSE';

/**
 * POST /api/chat/stream and dispatch each SSE event to onEvent({event, data}).
 * The request includes the optional profile name and knowledge-base availability.
 * Resolves with {completed: boolean} where completed means a `done` or `error`
 * event was received. Throws ApiError for HTTP/network failures.
 */
export async function streamChat({ message, threadId, profileName = '', knowledgeBaseAvailable = false, knowledgeBaseUserId, signal, onEvent }) {
  const response = await request(ENDPOINTS.chatStream, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      message,
      thread_id: threadId,
      profile_name: profileName,
      knowledge_base_available: knowledgeBaseAvailable,
      knowledge_base_user_id: knowledgeBaseUserId,
    }),
    signal,
  });

  let completed = false;
  try {
    await readSSE(
      response,
      (evt) => {
        if (evt.parseError) {
          onEvent({ event: 'client_warning', data: { message: 'Received an unreadable event from the server.' } });
          return;
        }
        if (evt.event === 'done' || evt.event === 'error') completed = true;
        onEvent({ event: evt.event, data: evt.data });
      },
      signal
    );
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) throw new ApiError('Request cancelled.', { kind: 'abort' });
    throw new ApiError('The connection to the backend was interrupted.', { kind: 'network' });
  }
  if (signal?.aborted) throw new ApiError('Request cancelled.', { kind: 'abort' });
  return { completed };
}
