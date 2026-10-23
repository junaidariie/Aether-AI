import { useState } from 'react';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import AudioControls from './AudioControls';

export default function MessageActions({ message, tts, canRegenerate, onRegenerate, onSpeak, onFeedback }) {
  const [copied, setCopied] = useState(false);
  const hasText = !!message.content;

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
      {hasText && <AudioControls messageId={message.id} tts={tts} onSpeak={onSpeak} />}
      {hasText && (
        <>
          <button className={`action-btn ${message.feedback === 'up' ? 'active' : ''}`} aria-pressed={message.feedback === 'up'} aria-label="Good response" title="Good response (saved on this device only)" onClick={() => onFeedback(message.feedback === 'up' ? null : 'up')}><ThumbsUp size={16} /></button>
          <button className={`action-btn ${message.feedback === 'down' ? 'active' : ''}`} aria-pressed={message.feedback === 'down'} aria-label="Bad response" title="Bad response (saved on this device only)" onClick={() => onFeedback(message.feedback === 'down' ? null : 'down')}><ThumbsDown size={16} /></button>
        </>
      )}
    </div>
  );
}
