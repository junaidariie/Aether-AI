import { useEffect, useRef } from 'react';
import { ArrowUp, Mic, Loader2, X, Plus } from 'lucide-react';
import { MAX_MESSAGE_LENGTH } from '../utils/constants';
import { formatDuration } from '../utils/formatters';
import KnowledgeBaseTray from './KnowledgeBaseTray';

export default function ChatInput({ value, onChange, onSubmit, onStop, streaming, enterToSend, stt, inputRef, variant = 'dock', disabledReason, transcriptTranslated, knowledgeBase }) {
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const trimmed = value.trim();
  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend = !!trimmed && !tooLong && !streaming && !disabledReason;

  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value, inputRef]);

  useEffect(() => {
    if (!knowledgeBase?.open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) knowledgeBase.close();
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') knowledgeBase.close();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [knowledgeBase?.open, knowledgeBase?.close]);

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const modifier = e.ctrlKey || e.metaKey;
    const send = enterToSend ? !e.shiftKey : modifier;
    if (send) { e.preventDefault(); if (canSend) onSubmit(); }
  };

  const recording = stt.status === 'recording';
  const transcribing = stt.status === 'transcribing';

  return (
    <div className={`composer-wrap ${variant}`} ref={wrapperRef}>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); if (canSend) onSubmit(); }}>
        <div className="composer-tools">
          <div className="composer-left">
            {knowledgeBase && (
              <button
                type="button"
                className={`icon-btn kb-trigger ${knowledgeBase.open ? 'active' : ''}`}
                onClick={knowledgeBase.toggle}
                aria-label="Add or manage documents"
                aria-expanded={knowledgeBase.open}
                title="Add or manage PDFs"
                disabled={recording || transcribing}
              >
                <Plus size={20} />
                {knowledgeBase.documents.length > 0 && <span className="kb-count">{knowledgeBase.documents.length}</span>}
              </button>
            )}
            {recording && <button type="button" className="icon-btn" onClick={stt.cancel} aria-label="Cancel recording"><X size={20} /></button>}
          </div>
          <div className="composer-entry">
            {recording ? (
              <div className="recording" role="status" aria-live="polite">
                <span className="rec-dot" aria-hidden="true" />
                <span>Recording… {formatDuration(stt.seconds)}</span>
              </div>
            ) : (
              <textarea
                ref={inputRef} className="composer-input" rows={1} value={value}
                onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
                placeholder={transcribing ? 'Transcribing your speech…' : 'Ask Aether AI'}
                aria-label="Message" disabled={transcribing}
              />
            )}
          </div>
          <div className="composer-right">
            {recording ? (
              <button type="button" className="icon-btn mic-btn mic-recording" onClick={stt.stop} aria-label="Stop recording and transcribe" title="Stop recording and transcribe"><Mic size={20} /></button>
            ) : transcribing ? (
              <button type="button" className="round-btn" disabled aria-label="Transcribing"><Loader2 size={18} className="spin" /></button>
            ) : (
              <button type="button" className="icon-btn mic-btn" onClick={stt.start} disabled={streaming} aria-label="Start voice input" title={stt.supported ? 'Dictate' : 'Voice input is not supported in this browser'}><Mic size={20} /></button>
            )}
            {streaming ? (
              <button type="button" className="round-btn" onClick={onStop} aria-label="Stop generating"><Square size={16} /></button>
            ) : (
              <button type="submit" className="round-btn send" disabled={!canSend} aria-label="Send message"><ArrowUp size={20} /></button>
            )}
          </div>
        </div>
      </form>
      {knowledgeBase?.open && <KnowledgeBaseTray knowledgeBase={knowledgeBase} fileInputRef={fileInputRef} />}
      <div className="composer-notes" aria-live="polite">
        {transcriptTranslated && <span className="muted small">Translated to English from speech. Review before sending.</span>}
        {stt.error && <span className="error-text" role="alert">{stt.error} <button className="link-btn" onClick={stt.clearError}>Dismiss</button></span>}
        {disabledReason && <span className="error-text">{disabledReason}</span>}
        {tooLong && <span className="error-text" role="alert">Message is {value.length - MAX_MESSAGE_LENGTH} characters over the {MAX_MESSAGE_LENGTH.toLocaleString()} limit.</span>}
        {!tooLong && value.length > MAX_MESSAGE_LENGTH * 0.8 && <span className="muted small">{value.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}</span>}
      </div>
    </div>
  );
}
