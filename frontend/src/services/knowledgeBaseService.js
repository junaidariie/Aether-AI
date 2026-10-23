import { ENDPOINTS, ApiError, apiUrl, request } from './api';

export async function listKnowledgeBaseDocuments(userId, signal) {
  const response = await request(ENDPOINTS.knowledgeBaseDocuments, {
    signal,
    headers: { 'X-Knowledge-Base-User': userId },
  });
  const data = await response.json();
  if (!Array.isArray(data?.documents)) {
    throw new ApiError('The knowledge-base endpoint returned an invalid document list.');
  }
  return data.documents;
}

export function uploadKnowledgeBasePdf(file, userId, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('files', file, file.name);

    xhr.open('POST', apiUrl(ENDPOINTS.knowledgeBaseUpload));
    xhr.setRequestHeader('X-Knowledge-Base-User', userId);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.({ status: 'uploading', progress: null });
        return;
      }
      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress?.({
        status: progress >= 100 ? 'indexing' : 'uploading',
        progress,
      });
    };
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = typeof data?.detail === 'string'
          ? data.detail
          : `Upload failed with status ${xhr.status}.`;
        reject(new ApiError(message, { status: xhr.status }));
        return;
      }
      const result = data?.results?.find((item) => item.filename === file.name);
      if (!data?.success || !result?.success) {
        reject(new ApiError(result?.message || data?.message || 'The PDF could not be indexed.'));
        return;
      }
      resolve(result);
    };
    xhr.onerror = () => reject(new ApiError('Unable to connect to the backend while uploading the PDF.', { kind: 'network' }));
    xhr.onabort = () => reject(new ApiError('PDF upload cancelled.', { kind: 'abort' }));
    if (signal) {
      if (signal.aborted) {
        reject(new ApiError('PDF upload cancelled.', { kind: 'abort' }));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

export async function removeKnowledgeBaseDocument(documentId, userId, signal) {
  await request(`${ENDPOINTS.knowledgeBaseDocuments}/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
    headers: { 'X-Knowledge-Base-User': userId },
    signal,
  });
}
