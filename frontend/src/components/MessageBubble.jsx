import { AlertTriangle, Languages, StopCircle } from 'lucide-react';
import logo from '../assets/logo.svg';
import MarkdownContent from './MarkdownContent';
import ActivityPanel from './ActivityPanel';
import SourceCards from './SourceCards';
import MessageActions from './MessageActions';
import LoadingIndicator from './LoadingIndicator';

export default function MessageBubble({ message, isStreaming, canRegenerate, tts, onRegenerate, onSpeak, onFeedback }) {
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

  const { activity, status } = message;
  const hasContent = !!message.content;
  const showEmpty = status === 'done' && !hasContent;

  return (
    <article className="msg assistant" aria-busy={isStreaming}>
      <img className="msg-avatar" src={logo} alt="" width="28" height="28" />
      <div className="msg-body">
        {activity && <ActivityPanel activity={activity} streaming={isStreaming} status={status} />}
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
          <MessageActions message={message} tts={tts} canRegenerate={canRegenerate} onRegenerate={onRegenerate} onSpeak={onSpeak} onFeedback={onFeedback} />
        )}
      </div>
    </article>
  );
}
