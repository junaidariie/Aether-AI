import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import ChatWindow from './components/ChatWindow';
import WelcomeScreen from './components/WelcomeScreen';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import ProfileSetup from './components/ProfileSetup';
import ConfirmationModal from './components/ConfirmationModal';
import { useChatHistory } from './hooks/useChatHistory';
import { useChat } from './hooks/useChat';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { useSpeechToText } from './hooks/useSpeechToText';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { checkHealth } from './services/api';
import { fetchVoices } from './services/speechService';
import { loadProfile, saveProfile, loadSettings, saveSettings, removeKeys } from './services/storageService';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './utils/constants';

export default function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [settings, setSettings] = useState(loadSettings);
  const [online, setOnline] = useState(null);
  const [draft, setDraft] = useState('');
  const [draftTranslated, setDraftTranslated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'delete'|'clear'|'reset', id?}
  const [voices, setVoices] = useState({ list: [], loading: false, error: '', loaded: false });
  const inputRef = useRef(null);

  const history = useChatHistory({ saveLocally: settings.saveLocally });
  const knowledgeBase = useKnowledgeBase();
  const { active } = history;
  const activeRef = useRef(active);
  const settingsRef = useRef(settings);
  useEffect(() => { activeRef.current = active; settingsRef.current = settings; });

  const tts = useTextToSpeech({ voice: settings.voice, speed: settings.speed });
  const chat = useChat({
    history,
    profileName: profile.name,
    knowledgeBaseAvailable: knowledgeBase.documents.length > 0,
    knowledgeBaseUserId: knowledgeBase.userId,
    onComplete: (convId, msg) => {
      if (settingsRef.current.autoRead && activeRef.current?.id === convId) tts.speak(msg.id, msg.content);
    },
  });

  // ---- theme ----
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.setAttribute('data-theme', t);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveProfile(profile); }, [profile]);

  // ---- backend health ----
  useEffect(() => {
    let alive = true;
    const run = async () => { const r = await checkHealth(); if (alive) setOnline(r.ok); };
    run();
    const id = setInterval(run, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // ---- voices (loaded when settings first open) ----
  const loadVoices = useCallback(async () => {
    setVoices((v) => ({ ...v, loading: true, error: '' }));
    try {
      const list = await fetchVoices();
      setVoices({ list, loading: false, error: '', loaded: true });
    } catch (err) {
      setVoices({ list: [], loading: false, error: `Could not load voices: ${err.message}`, loaded: true });
    }
  }, []);
  useEffect(() => { if (showSettings && !voices.loaded && !voices.loading) loadVoices(); }, [showSettings, voices.loaded, voices.loading, loadVoices]);

  // ---- actions ----
  const patchSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  const sendText = useCallback((text, { translated = false } = {}) => {
    const conv = activeRef.current;
    if (!conv) return;
    tts.stop();
    if (chat.send(conv, text, { translated })) {
      setDraft('');
      setDraftTranslated(false);
    }
  }, [chat, tts]);

  const stt = useSpeechToText({
    translation: settings.translateSpeech,
    onResult: (text, { translated } = {}) => {
      setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text));
      setDraftTranslated((wasTranslated) => wasTranslated || !!translated);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  });

  const handleNew = () => {
    if (active) chat.stop(active.id);
    tts.stop();
    history.newChat();
    setDraft('');
    setDraftTranslated(false);
    setMobileOpen(false);
  };

  const handleSelect = (id) => {
    if (id !== active?.id) {
      if (active) chat.stop(active.id);
      tts.stop();
      setDraft('');
      setDraftTranslated(false);
    }
    history.select(id);
    setMobileOpen(false);
  };

  const requestDelete = (id) => {
    if (settings.confirmDelete) setConfirm({ kind: 'delete', id });
    else doDelete(id);
  };
  const doDelete = (id) => { chat.stop(id); history.remove(id); };

  const doClear = () => { chat.stopAll(); tts.stop(); history.clearAll(); setDraft(''); setDraftTranslated(false); };

  const doReset = () => {
    chat.stopAll(); tts.stop(); history.clearAll();
    setDraft('');
    setDraftTranslated(false);
    removeKeys(Object.values(STORAGE_KEYS));
    knowledgeBase.resetUser();
    setSettings({ ...DEFAULT_SETTINGS });
    setProfile({ name: '', onboarded: false });
  };

  const onConfirm = () => {
    const c = confirm;
    setConfirm(null);
    if (c.kind === 'delete') doDelete(c.id);
    if (c.kind === 'clear') doClear();
    if (c.kind === 'reset') doReset();
  };

  const confirmCopy = useMemo(() => ({
    delete: { title: 'Delete this conversation?', message: 'This permanently removes the conversation from this browser. This cannot be undone.', label: 'Delete' },
    clear: { title: 'Clear all conversation history?', message: 'Every saved conversation on this device will be permanently removed.', label: 'Clear history' },
    reset: { title: 'Reset local profile?', message: 'This removes your display name, settings and all saved conversations from this browser. Nothing is stored on the server.', label: 'Reset everything' },
  }), []);

  const messages = active?.messages || [];
  const streamingId = active ? chat.streaming[active.id] : null;
  const isStreaming = !!streamingId;
  const hasMessages = messages.length > 0;

  const composer = (variant) => (
    <ChatInput
      value={draft}
      onChange={(value) => { setDraft(value); setDraftTranslated(false); }}
      onSubmit={() => sendText(draft, { translated: draftTranslated })}
      onStop={() => active && chat.stop(active.id)}
      streaming={isStreaming} enterToSend={settings.enterToSend} stt={stt} inputRef={inputRef} variant={variant}
      transcriptTranslated={draftTranslated}
      knowledgeBase={knowledgeBase}
    />
  );

  return (
    <div className="app">
      <Sidebar
        conversations={history.conversations} activeId={active?.id} collapsed={collapsed} mobileOpen={mobileOpen} profile={profile}
        onNew={handleNew} onSelect={handleSelect} onRename={history.rename} onDelete={requestDelete} onTogglePin={history.togglePin}
        onToggleCollapse={() => setCollapsed((v) => !v)} onCloseMobile={() => setMobileOpen(false)}
        onOpenSettings={() => { setShowSettings(true); setMobileOpen(false); }}
        onRenameProfile={(name) => setProfile((p) => ({ ...p, name }))}
        onClearHistory={() => setConfirm({ kind: 'clear' })} onResetProfile={() => setConfirm({ kind: 'reset' })}
      />

      <main className="main">
        <ChatHeader title={hasMessages ? active.title : ''} onOpenSidebar={() => setMobileOpen(true)} onNewChat={handleNew} />
        {online === false && (
          <div className="banner error" role="alert">Unable to connect to the backend. Check that the API server is running.</div>
        )}
        {history.storageError && <div className="banner warn" role="alert">{history.storageError}</div>}
        {tts.error && (
          <div className="banner warn" role="alert">{tts.error} <button className="link-btn" onClick={tts.clearError}>Dismiss</button></div>
        )}

        {hasMessages ? (
          <>
            <ChatWindow
              conversationId={active.id} messages={messages} streamingMessageId={streamingId} tts={tts}
              onRegenerate={(id) => chat.regenerate(active, id)}
              onSpeak={(id, text) => tts.speak(id, text)}
              onFeedback={(id, v) => history.updateMessage(active.id, id, (m) => ({ ...m, feedback: v }))}
            />
            <div className="dock">{composer('dock')}</div>
          </>
        ) : (
          <div className="welcome-stage">
            <div className="welcome-scroll">
              <WelcomeScreen name={profile.name} />
            </div>
            <div className="welcome-dock">{composer('home')}</div>
          </div>
        )}
      </main>

      {!profile.onboarded && (
        <ProfileSetup
          theme={settings.theme === 'light' ? 'light' : 'dark'}
          onThemeChange={(theme) => patchSettings({ theme })}
          onContinue={(name) => setProfile({ name, onboarded: true })}
          onSkip={() => setProfile({ name: '', onboarded: true })}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings} onChange={patchSettings} profileName={profile.name}
          onRenameProfile={(name) => setProfile((p) => ({ ...p, name }))}
          voices={voices} onRetryVoices={loadVoices} storageError={history.storageError}
          onClearHistory={() => setConfirm({ kind: 'clear' })} onClose={() => setShowSettings(false)}
        />
      )}

      {confirm && (
        <ConfirmationModal
          title={confirmCopy[confirm.kind].title} message={confirmCopy[confirm.kind].message}
          confirmLabel={confirmCopy[confirm.kind].label} danger onConfirm={onConfirm} onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
