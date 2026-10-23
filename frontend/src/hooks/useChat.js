import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat } from '../services/chatService';
import { uid } from '../utils/formatters';

const newActivity = () => ({ phase: 'preparing', routingStatus: 'pending', routing: null, statusText: '', timeline: [] });

/** Pure reducer: apply one backend SSE event to an assistant message. */
export function applyEvent(msg, { event, data }) {
  const a = { ...msg.activity, timeline: [...msg.activity.timeline] };
  const d = data || {};
  switch (event) {
    case 'routing':
      a.routing = { model: d.model, task: d.task, confidence: d.confidence, reason: d.reason };
      a.routingStatus = 'done';
      a.phase = 'supervisor';
      return { ...msg, activity: a };
    case 'status':
      a.statusText = String(d.message || '');
      a.timeline.push({ kind: 'status', text: a.statusText });
      if (a.phase === 'routing' || a.phase === 'preparing') a.phase = 'supervisor';
      return { ...msg, activity: a };
    case 'agent': {
      const name = String(d.name || 'unknown_agent');
      const idx = a.timeline.findIndex((t) => t.kind === 'agent' && t.name === name);
      const status = d.status === 'failed' ? 'failed' : d.status === 'completed' ? 'completed' : 'working';
      if (idx === -1) a.timeline.push({ kind: 'agent', name, status });
      else a.timeline[idx] = { ...a.timeline[idx], status };
      a.phase = 'agent';
      return { ...msg, activity: a };
    }
    case 'tool': {
      const name = String(d.name || 'unknown_tool');
      if (d.status === 'running') {
        a.timeline.push({ kind: 'tool', name, status: 'running', output: null });
        a.phase = 'tool';
      } else {
        // "finished": close the most recent running call with this name
        let i = -1;
        for (let k = a.timeline.length - 1; k >= 0; k--) {
          const t = a.timeline[k];
          if (t.kind === 'tool' && t.name === name && t.status === 'running') { i = k; break; }
        }
        if (i === -1) a.timeline.push({ kind: 'tool', name, status: 'finished', output: null });
        else a.timeline[i] = { ...a.timeline[i], status: 'finished' };
      }
      return { ...msg, activity: a };
    }
    case 'tool_result': {
      const name = String(d.name || 'unknown_tool');
      let i = -1;
      for (let k = 0; k < a.timeline.length; k++) {
        const t = a.timeline[k];
        if (t.kind === 'tool' && t.name === name && t.output == null) { i = k; break; }
      }
      if (i === -1) a.timeline.push({ kind: 'tool', name, status: 'finished', output: String(d.output ?? '') });
      else a.timeline[i] = { ...a.timeline[i], output: String(d.output ?? '') };
      return { ...msg, activity: a };
    }
    case 'token':
      a.phase = 'answering';
      return { ...msg, content: msg.content + String(d.text || ''), activity: a };
    case 'done': {
      const final = typeof d.answer === 'string' && d.answer ? d.answer : msg.content;
      a.phase = 'done';
      a.timeline = a.timeline.map((t) =>
        t.kind === 'agent' && t.status === 'working' ? { ...t, status: 'completed' } : t
      );
      return { ...msg, content: final, status: 'done', activity: a };
    }
    case 'error': {
      a.failedPhase = a.phase;
      a.phase = 'error';
      if (a.routingStatus === 'pending') a.routingStatus = 'error';
      a.timeline = a.timeline.map((t) =>
        (t.kind === 'agent' && t.status === 'working') || (t.kind === 'tool' && t.status === 'running')
          ? { ...t, status: 'failed' }
          : t
      );
      return { ...msg, status: 'error', error: { message: String(d.message || 'Something went wrong.'), hint: d.hint ? String(d.hint) : '' }, activity: a };
    }
    default:
      return msg;
  }
}

export function useChat({ history, onComplete, profileName = '', knowledgeBaseAvailable = false, knowledgeBaseUserId = '' }) {
  const [streaming, setStreaming] = useState({}); // {conversationId: assistantMessageId}
  const controllers = useRef(new Map());
  const onCompleteRef = useRef(onComplete);
  const profileNameRef = useRef(profileName);
  const knowledgeBaseAvailableRef = useRef(knowledgeBaseAvailable);
  const knowledgeBaseUserIdRef = useRef(knowledgeBaseUserId);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { profileNameRef.current = profileName; }, [profileName]);
  useEffect(() => { knowledgeBaseAvailableRef.current = knowledgeBaseAvailable; }, [knowledgeBaseAvailable]);
  useEffect(() => { knowledgeBaseUserIdRef.current = knowledgeBaseUserId; }, [knowledgeBaseUserId]);
  const { addTurn, updateMessage } = history;

  const run = useCallback(async (conv, text, { userMsg, replaceFromIndex } = {}) => {
    const convId = conv.id;
    if (controllers.current.has(convId)) return; // never run two streams in one conversation
    const assistantMsg = {
      id: uid(), role: 'assistant', content: '', status: 'streaming', createdAt: Date.now(),
      activity: { ...newActivity(), phase: 'routing' }, error: null, feedback: null,
    };
    addTurn(convId, userMsg, assistantMsg, { replaceFromIndex });

    const controller = new AbortController();
    controllers.current.set(convId, controller);
    setStreaming((s) => ({ ...s, [convId]: assistantMsg.id }));
    const patch = (fn) => updateMessage(convId, assistantMsg.id, fn);
    let answer = '';
    let finished = false;

    try {
      const { completed } = await streamChat({
        message: text,
        threadId: conv.threadId,
        profileName: profileNameRef.current,
        knowledgeBaseAvailable: knowledgeBaseAvailableRef.current,
        knowledgeBaseUserId: knowledgeBaseUserIdRef.current,
        signal: controller.signal,
        onEvent: (evt) => {
          if (evt.event === 'client_warning') return;
          if (evt.event === 'token') answer += String(evt.data?.text || '');
          if (evt.event === 'done') { finished = true; if (evt.data?.answer) answer = evt.data.answer; }
          patch((m) => applyEvent(m, evt));
        },
      });
      if (!completed) {
        patch((m) => applyEvent(m, { event: 'error', data: { message: 'The response stream ended unexpectedly.', hint: 'The partial answer is kept. You can regenerate the response.' } }));
      }
    } catch (err) {
      if (err.kind === 'abort') {
        patch((m) => ({
          ...m,
          status: 'stopped',
          activity: { ...m.activity, stoppedPhase: m.activity.phase, phase: 'stopped' },
        }));
      } else {
        patch((m) => applyEvent(m, { event: 'error', data: { message: err.message, hint: err.hint } }));
      }
    } finally {
      controllers.current.delete(convId);
      setStreaming((s) => { const n = { ...s }; delete n[convId]; return n; });
      if (finished) onCompleteRef.current?.(convId, { id: assistantMsg.id, content: answer });
    }
  }, [addTurn, updateMessage]);

  const send = useCallback((conv, text, { translated = false } = {}) => {
    const clean = text.trim();
    if (!clean) return false;
    if (controllers.current.has(conv.id)) return false;
    run(conv, clean, {
      userMsg: {
        id: uid(),
        role: 'user',
        content: clean,
        createdAt: Date.now(),
        ...(translated ? { translated: true } : {}),
      },
    });
    return true;
  }, [run]);

  const regenerate = useCallback((conv, assistantMsgId) => {
    const idx = conv.messages.findIndex((m) => m.id === assistantMsgId);
    if (idx < 1) return;
    const prompt = conv.messages[idx - 1];
    if (prompt.role !== 'user') return;
    run(conv, prompt.content, { replaceFromIndex: idx });
  }, [run]);

  const stop = useCallback((convId) => controllers.current.get(convId)?.abort(), []);
  const stopAll = useCallback(() => controllers.current.forEach((c) => c.abort()), []);

  useEffect(() => () => controllers.current.forEach((c) => c.abort()), []);

  return { streaming, send, regenerate, stop, stopAll };
}
