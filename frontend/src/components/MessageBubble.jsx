import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Languages, Loader2, StopCircle, XCircle } from 'lucide-react';
import logo from '../assets/logo.svg';
import MarkdownContent from './MarkdownContent';
import ActivityPanel from './ActivityPanel';
import SourceCards from './SourceCards';
import MessageActions from './MessageActions';
import LoadingIndicator from './LoadingIndicator';
import { agentLabel, toolMeta } from '../utils/formatters';

export default function MessageBubble({ message, isStreaming, canRegenerate, tts, onRegenerate, onSpeak }) {
  const [showProgress, setShowProgress] = useState(false);
  if (message.role === 'user') {
    return (
      <div className="msg user">
        <div className="user-bubble">
          {message.translated && <span className="translated-label"><Languages size={14} aria-hidden="true" /> Speech translated to English</span>}
          {message.content}
        </div>
      </div>
    );
  }

  const { status } = message;
  const activity = message.activity;
  const timeline = activity?.timeline || [];
  const hasContent = !!message.content;
  const showEmpty = status === 'done' && !hasContent;
  const activeTool = [...timeline].reverse().find((item) => item.kind === 'tool' && item.status === 'running');
  const activeAgent = [...timeline].reverse().find((item) => item.kind === 'agent' && item.status === 'working');
  const progressLabel = status === 'done'
    ? 'Complete'
    : status === 'error'
      ? 'Could not complete'
      : status === 'stopped'
        ? 'Stopped'
        : activeTool
          ? toolMeta(activeTool.name).label
          : activeAgent
            ? agentLabel(activeAgent.name)
            : activity?.phase === 'routing' || activity?.phase === 'preparing'
              ? 'Laya'
              : activity?.phase === 'supervisor'
                ? 'Supervisor'
                : activity?.phase === 'answering'
                  ? 'Generating response'
                  : activity?.phase === 'agent'
                    ? 'Specialist agent'
                    : 'Preparing response';
  const ProgressIcon = status === 'done' ? CheckCircle2 : status === 'error' || status === 'stopped' ? XCircle : Loader2;

  return (
    <article className="msg assistant" aria-busy={isStreaming}>
      <img className="msg-avatar" src={logo} alt="" width="28" height="28" />
      <div className="msg-body">
        {activity && (
          <div className={`live-progress ${status === 'done' ? 'complete' : status === 'error' || status === 'stopped' ? 'failed' : ''}`} role="status" aria-live="polite">
            <ProgressIcon size={15} className={isStreaming ? 'spin' : ''} aria-hidden="true" />
            <span key={progressLabel} className="live-progress-label">{progressLabel}</span>
          </div>
        )}
        {isStreaming && !hasContent && <LoadingIndicator phase={activity?.phase} />}
        {hasContent && <MarkdownContent>{message.content}</MarkdownContent>}
        {isStreaming && hasContent && <span className="cursor" aria-hidden="true" />}
        {showEmpty && <p className="muted"><em>The assistant returned an empty response. You can regenerate it.</em></p>}
        {status === 'stopped' && <p className="note"><StopCircle size={14} aria-hidden="true" /> Generation stopped.</p>}
        {status === 'error' && message.error && (
          <div className="error-box" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>{message.error.message}</strong>
              {message.error.hint && <p className="small">{message.error.hint}</p>}
            </div>
          </div>
        )}
        {activity && <SourceCards timeline={activity.timeline} />}
        {!isStreaming && (
          <>
            <MessageActions
              message={message}
              tts={tts}
              canRegenerate={canRegenerate}
              onRegenerate={onRegenerate}
              onSpeak={onSpeak}
              showProgress={showProgress}
              onToggleProgress={() => setShowProgress((visible) => !visible)}
            />
            {showProgress && activity && <ActivityPanel activity={activity} streaming={isStreaming} status={status} />}
          </>
        )}
      </div>
    </article>
  );
}
