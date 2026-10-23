import { Check, FileText, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react';

function UploadStatus({ upload, onDismiss }) {
  const active = upload.status === 'uploading' || upload.status === 'indexing';
  return (
    <li className={`kb-item ${upload.status}`}>
      <span className="kb-file-icon"><FileText size={16} aria-hidden="true" /></span>
      <span className="kb-file-info">
        <span className="kb-file-name" title={upload.filename}>{upload.filename}</span>
        <span className={upload.status === 'error' ? 'error-text small' : 'muted small'}>
          {upload.status === 'uploading'
            ? `Uploading${upload.progress == null ? '…' : ` · ${upload.progress}%`}`
            : upload.status === 'indexing'
              ? 'Upload complete · indexing PDF…'
              : upload.status === 'complete'
                ? 'Added to your knowledge base'
                : upload.error}
        </span>
        {active && (
          <span className={`kb-progress ${upload.status === 'indexing' ? 'indeterminate' : ''}`} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={upload.progress ?? undefined}>
            <span style={upload.status === 'uploading' && upload.progress != null ? { width: `${upload.progress}%` } : undefined} />
          </span>
        )}
      </span>
      {!active && (
        <button className="icon-btn kb-remove" type="button" onClick={() => onDismiss(upload.id)} aria-label={`Dismiss ${upload.filename} upload status`}>
          <X size={15} />
        </button>
      )}
      {upload.status === 'complete' && <Check size={16} className="kb-success" aria-label="Uploaded" />}
      {active && <Loader2 size={16} className="spin kb-spinner" aria-label="Working" />}
    </li>
  );
}

export default function KnowledgeBaseTray({ knowledgeBase, fileInputRef }) {
  const {
    documents, uploads, loading, loaded, removingId, error,
    uploadFiles, remove, dismissUpload, refresh, clearError,
  } = knowledgeBase;
  const hasContent = documents.length || uploads.length;

  return (
    <section className="kb-tray" aria-label="Manage uploaded documents">
      <div className="kb-tray-head">
        <div>
          <h3>Knowledge base</h3>
          <p className="muted small">Your library is scoped to this browser profile. Ask questions about its PDFs in chat.</p>
        </div>
        <div className="kb-tray-actions">
          <button className="btn btn-ghost kb-refresh" type="button" onClick={refresh} disabled={loading} aria-label="Refresh documents">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary kb-upload" type="button" onClick={() => { refresh(); fileInputRef.current?.click(); }} disabled={uploads.some((upload) => upload.status === 'uploading' || upload.status === 'indexing')}>
            <Upload size={15} /> Add PDFs
          </button>
        </div>
      </div>

      {error && <p className="kb-error error-text" role="alert">{error} <button type="button" className="link-btn" onClick={clearError}>Dismiss</button></p>}

      {!hasContent && (
        <p className="kb-empty muted small">
          {loading ? 'Loading your documents…' : loaded ? 'No PDFs added yet. Upload a PDF to ask questions about its contents.' : 'Your library has not been loaded yet. Choose Add PDFs or refresh to view it.'}
        </p>
      )}

      {!!uploads.length && (
        <ul className="kb-list" aria-label="PDF upload status">
          {uploads.map((upload) => <UploadStatus key={upload.id} upload={upload} onDismiss={dismissUpload} />)}
        </ul>
      )}

      {!!documents.length && (
        <ul className="kb-list" aria-label="Uploaded PDFs">
          {documents.map((document) => (
            <li className="kb-item" key={document.id}>
              <span className="kb-file-icon"><FileText size={16} aria-hidden="true" /></span>
              <span className="kb-file-info">
                <span className="kb-file-name" title={document.filename}>{document.filename}</span>
                <span className="muted small">{document.pages} page{document.pages === 1 ? '' : 's'} · {document.chunks} indexed sections</span>
              </span>
              <button
                className="icon-btn kb-remove"
                type="button"
                onClick={() => remove(document)}
                disabled={removingId === document.id}
                aria-label={`Remove ${document.filename}`}
                title="Remove this PDF"
              >
                {removingId === document.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInputRef}
        className="kb-file-input"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        aria-label="Choose PDF files"
        onChange={(event) => {
          if (event.target.files?.length) uploadFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </section>
  );
}
