import { useState } from 'react';
import { Copy, Check, RefreshCw, ListChecks, Cpu } from 'lucide-react';
import AudioControls from './AudioControls';

export default function MessageActions({ message, tts, canRegenerate, onRegenerate, onSpeak, showProgress, onToggleProgress }) {
  const [copied, setCopied] = useState(false);
  const [showModelReason, setShowModelReason] = useState(false);
  const hasText = !!message.content;
  const routing = message.activity?.routing;
  const model = routing?.model;
  const task = routing?.task;
  const reason = routing?.reason || (task
    ? `Laya classified this as a ${task} request and selected this model based on that assessment.`
    : 'Laya selected this model based on its understanding of your request.');

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
      {model && (
        <span className="model-selector">
          <button
            type="button"
            className="model-label"
            onClick={() => setShowModelReason((visible) => !visible)}
            aria-expanded={showModelReason}
            aria-label={`Model used: ${model}. Show why Laya chose it.`}
            title="Show why Laya chose this model"
          >
            <Cpu size={14} aria-hidden="true" />
            <span>{model}</span>
          </button>
          {showModelReason && (
            <span className="model-reason" role="note">
              <strong>Laya chose this model</strong>
              {task && <span>Request type: {task}</span>}
              <span>{reason}</span>
            </span>
          )}
        </span>
      )}
      {hasText && <AudioControls messageId={message.id} tts={tts} onSpeak={onSpeak} />}
    </div>
  );
}
