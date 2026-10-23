import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ conversationId, messages, streamingMessageId, tts, onRegenerate, onSpeak, onFeedback }) {
  const scroller = useRef(null);
  const stick = useRef(true);

  useEffect(() => { stick.current = true; }, [conversationId]);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, conversationId]);

  const onScroll = () => {
    const el = scroller.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
      <div className="chat-column" role="log" aria-live="off" aria-label="Conversation">
        {messages.map((m) => (
          <MessageBubble
            key={m.id} message={m}
            isStreaming={m.id === streamingMessageId}
            canRegenerate={m.id === lastAssistantId && !streamingMessageId}
            tts={tts}
            onRegenerate={() => onRegenerate(m.id)}
            onSpeak={() => onSpeak(m.id, m.content)}
            onFeedback={(v) => onFeedback(m.id, v)}
          />
        ))}
      </div>
    </div>
  );
}
