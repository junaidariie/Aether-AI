import { useState } from 'react';
import { Copy, Check, RefreshCw, ListChecks, Cpu } from 'lucide-react';
import AudioControls from './AudioControls';

export default function MessageActions({ message, tts, canRegenerate, onRegenerate, onSpeak, showProgress, onToggleProgress }) {
  const [copied, setCopied] = useState(false);
  const hasText = !!message.content;
  const model = message.activity?.routing?.model;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="message-actions" role="group" aria-label="Response actions">
      {hasText && (
        <button className="action-btn" onClick={copy} aria-label="Copy response" title="Copy response">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      )}
      {canRegenerate && (
        <button className="action-btn" onClick={onRegenerate} aria-label="Regenerate response" title="Regenerate response"><RefreshCw size={16} /></button>
      )}
      {message.activity && (
        <button className={`action-btn progress-toggle ${showProgress ? 'active' : ''}`} onClick={onToggleProgress} aria-expanded={showProgress} aria-label={showProgress ? 'Hide progress' : 'Show progress'} title={showProgress ? 'Hide progress' : 'Show progress'}>
          <ListChecks size={16} />
          <span>{showProgress ? 'Hide progress' : 'Show progress'}</span>
        </button>
      )}
      {model && <span className="model-label" title={`Model used: ${model}`}><Cpu size={14} aria-hidden="true" />{model}</span>}
      {hasText && <AudioControls messageId={message.id} tts={tts} onSpeak={onSpeak} />}
    </div>
  );
}
