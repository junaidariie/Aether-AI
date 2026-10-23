import { useCallback, useState } from 'react';
import { uid } from '../utils/formatters';
import { loadKnowledgeBaseUserId, resetKnowledgeBaseUserId } from '../services/storageService';
import { listKnowledgeBaseDocuments, removeKnowledgeBaseDocument, uploadKnowledgeBasePdf } from '../services/knowledgeBaseService';

const MAX_PDF_SIZE = 20 * 1024 * 1024;

export function useKnowledgeBase() {
  const [userId, setUserId] = useState(loadKnowledgeBaseUserId);
  const [documents, setDocuments] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listKnowledgeBaseDocuments(userId);
      setDocuments(result);
      setLoaded(true);
      return result;
    } catch (err) {
      setError(err.message || 'Could not load uploaded documents.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [open]);
  const close = useCallback(() => setOpen(false), []);

  const uploadFiles = useCallback(async (fileList) => {
    setOpen(true);
    setError('');
    for (const file of Array.from(fileList)) {
      const id = uid();
      const failure = !file.name.toLowerCase().endsWith('.pdf')
        ? 'Only PDF files are supported.'
        : file.size > MAX_PDF_SIZE
          ? 'PDFs must be 20 MB or smaller.'
          : file.size === 0
            ? 'This file is empty.'
            : '';
      const entry = {
        id,
        filename: file.name,
        status: failure ? 'error' : 'uploading',
        progress: 0,
        error: failure,
      };
      setUploads((current) => [...current, entry]);
      if (failure) continue;

      try {
        await uploadKnowledgeBasePdf(file, userId, {
          onProgress: ({ status, progress }) => {
            setUploads((current) => current.map((item) => item.id === id ? { ...item, status, progress } : item));
          },
        });
        setUploads((current) => current.map((item) => item.id === id ? { ...item, status: 'complete', progress: 100 } : item));
        setError('');
        await refresh()
          .then(() => setUploads((current) => current.filter((item) => item.id !== id)))
          .catch(() => {});
      } catch (err) {
        setUploads((current) => current.map((item) => item.id === id ? { ...item, status: 'error', error: err.message } : item));
        setError(err.message || `Could not upload ${file.name}.`);
      }
    }
  }, [refresh, userId]);

  const remove = useCallback(async (document) => {
    setRemovingId(document.id);
    setError('');
    try {
      await removeKnowledgeBaseDocument(document.id, userId);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (err) {
      setError(err.message || `Could not remove ${document.filename}.`);
    } finally {
      setRemovingId(null);
    }
  }, [userId]);

  const dismissUpload = useCallback((id) => {
    setUploads((current) => current.filter((item) => item.id !== id));
  }, []);

  const resetUser = useCallback(() => {
    setUserId(resetKnowledgeBaseUserId());
    setDocuments([]);
    setUploads([]);
    setLoaded(false);
    setError('');
    setOpen(false);
  }, []);

  return {
    userId,
    documents,
    uploads,
    loading,
    removingId,
    error,
    open,
    toggle,
    close,
    uploadFiles,
    remove,
    dismissUpload,
    refresh: () => refresh().catch(() => {}),
    loaded,
    resetUser,
    clearError: () => setError(''),
  };
}
