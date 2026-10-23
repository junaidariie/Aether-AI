import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Moon, Sun, Monitor, RefreshCw, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { API_BASE, ENDPOINTS, apiUrl, checkHealth } from '../services/api';
import { checkSpeechServices } from '../services/speechService';
import { SPEED_OPTIONS } from '../utils/constants';

const TABS = ['Profile', 'Appearance', 'Chat & memory', 'Speech-to-text', 'Text-to-speech', 'About', 'Technical'];

function Toggle({ id, label, hint, checked, onChange, disabled }) {
  return (
    <div className="setting-row">
      <div><label htmlFor={id}>{label}</label>{hint && <p className="muted small">{hint}</p>}</div>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

function ThemePicker({ value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Theme">
      {[['dark', Moon, 'Dark'], ['light', Sun, 'Light'], ['system', Monitor, 'System']].map(([v, Icon, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          <Icon size={16} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}

function Status({ ok, pending }) {
  if (pending) return <span className="act-status pending"><Loader2 size={14} className="spin" /> Checking</span>;
  return ok
    ? <span className="act-status completed"><CheckCircle2 size={14} /> Available</span>
    : <span className="act-status failed"><XCircle size={14} /> Unavailable</span>;
}

export default function SettingsModal({ settings, onChange, profileName, onRenameProfile, voices, onRetryVoices, storageError, onClearHistory, onClose }) {
  const [tab, setTab] = useState('Profile');
  const [name, setName] = useState(profileName);
  const [voiceFilter, setVoiceFilter] = useState('');
  const [tech, setTech] = useState({ pending: true, api: false, stt: false, tts: false });
  const [mic, setMic] = useState('unknown');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runChecks = useCallback(async () => {
    setTech((t) => ({ ...t, pending: true }));
    const [h, s] = await Promise.all([checkHealth(), checkSpeechServices()]);
    setTech({ pending: false, api: h.ok, ...s });
  }, []);

  useEffect(() => { if (tab === 'Technical') runChecks(); }, [tab, runChecks]);

  useEffect(() => {
    if (tab !== 'Speech-to-text' || !navigator.permissions?.query) return undefined;
    let status;
    navigator.permissions.query({ name: 'microphone' }).then((p) => {
      status = p; setMic(p.state); p.onchange = () => setMic(p.state);
    }).catch(() => setMic('unknown'));
    return () => { if (status) status.onchange = null; };
  }, [tab]);

  const filteredVoices = useMemo(() => {
    const q = voiceFilter.trim().toLowerCase();
    const list = q ? voices.list.filter((v) => v.id.toLowerCase().includes(q)) : voices.list;
    return list.some((v) => v.id === settings.voice) || !voices.list.length
      ? list
      : [voices.list.find((v) => v.id === settings.voice) || { id: settings.voice, gender: '' }, ...list];
  }, [voices.list, voiceFilter, settings.voice]);

  const micSupported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
        </div>
        <div className="settings-layout">
          <div className="tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div className="settings-panel" role="tabpanel">
            {tab === 'Profile' && (
              <section className="settings-section">
                <div>
                  <h3>Profile</h3>
                  <p className="muted small">Your display name is saved in this browser and used for greetings.</p>
                </div>
                <div className="setting-col">
                  <label htmlFor="s-name">Display name</label>
                  <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onRenameProfile(name.trim()); }}>
                    <input id="s-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                    <button className="btn btn-primary" type="submit" disabled={name.trim() === profileName}>Save</button>
                  </form>
                </div>
              </section>
            )}
            {tab === 'Appearance' && (
              <section className="settings-section">
                <div>
                  <h3>Appearance</h3>
                  <p className="muted small">Choose how Aether AI looks on this device.</p>
                </div>
                <div className="setting-col"><span className="label">Theme</span><ThemePicker value={settings.theme} onChange={(v) => onChange({ theme: v })} /><p className="muted small">System follows your device setting.</p></div>
              </section>
            )}
            {tab === 'Speech-to-text' && (
              <section className="settings-section">
                <div>
                  <h3>Speech-to-text</h3>
                  <p className="muted small">Voice transcripts are added to the message box for review. They are never sent automatically.</p>
                </div>
                <Toggle id="s-translate" label="Translate non-English speech to English" hint="When enabled, speech in another language is translated to English. English speech stays unlabeled." checked={settings.translateSpeech} onChange={(v) => onChange({ translateSpeech: v })} />
                <div className="setting-row">
                  <div><span className="label">Microphone</span><p className="muted small">{!micSupported ? 'Recording is not supported in this browser.' : mic === 'granted' ? 'Permission granted.' : mic === 'denied' ? 'Permission denied. Allow access in your browser settings.' : mic === 'prompt' ? 'Your browser will ask for permission when you start recording.' : 'Recording is supported. Permission status is unknown.'}</p></div>
                </div>
              </section>
            )}
            {tab === 'Text-to-speech' && (
              <section className="settings-section">
                <div>
                  <h3>Text-to-speech</h3>
                  <p className="muted small">Choose how written answers are read aloud.</p>
                </div>
                <div className="setting-col">
                  <label htmlFor="s-voice-filter">Read-aloud voice</label>
                  {voices.loading && <p className="muted small"><Loader2 size={14} className="spin" /> Loading voices from the backend…</p>}
                  {voices.error && <p className="error-text" role="alert">{voices.error} <button className="link-btn" onClick={onRetryVoices}>Retry</button></p>}
                  <input id="s-voice-filter" className="field" placeholder="Filter voices (e.g. en-US, Jenny)" value={voiceFilter} onChange={(e) => setVoiceFilter(e.target.value)} disabled={!voices.list.length} />
                  <select className="field" aria-label="Voice" value={settings.voice} onChange={(e) => onChange({ voice: e.target.value })}>
                    {filteredVoices.length === 0 && <option value={settings.voice}>{settings.voice}</option>}
                    {filteredVoices.map((v) => <option key={v.id} value={v.id}>{v.id}{v.gender ? ` (${v.gender})` : ''}</option>)}
                  </select>
                  {!voices.list.length && !voices.loading && <p className="muted small">Voice list unavailable. Only the backend's default voice is offered.</p>}
                </div>
                <div className="setting-col">
                  <label htmlFor="s-speed">Speech speed</label>
                  <select id="s-speed" className="field" value={settings.speed} onChange={(e) => onChange({ speed: Number(e.target.value) })}>
                    {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}x</option>)}
                  </select>
                </div>
                <Toggle id="s-auto" label="Read answers aloud automatically" checked={settings.autoRead} onChange={(v) => onChange({ autoRead: v })} />
              </section>
            )}
            {tab === 'Chat & memory' && (
              <section className="settings-section">
                <div>
                  <h3>Chat &amp; memory</h3>
                  <p className="muted small">Conversations are kept in this browser. IP addresses are not used to identify or separate people.</p>
                </div>
                <Toggle id="s-enter" label="Enter to send" hint={settings.enterToSend ? 'Shift+Enter inserts a new line.' : 'Ctrl/Cmd+Enter sends; Enter inserts a new line.'} checked={settings.enterToSend} onChange={(v) => onChange({ enterToSend: v })} />
                {storageError && <p className="error-text" role="alert">{storageError}</p>}
                <Toggle id="s-save" label="Save conversations locally" hint="Stored in this browser only. Turning this off keeps chats for this session." checked={settings.saveLocally} onChange={(v) => onChange({ saveLocally: v })} />
                <Toggle id="s-confirm" label="Confirm before deleting a conversation" checked={settings.confirmDelete} onChange={(v) => onChange({ confirmDelete: v })} />
                <div className="setting-row">
                  <div><span className="label">Clear conversation history</span><p className="muted small">Removes every saved conversation from this device.</p></div>
                  <button className="btn btn-danger" onClick={onClearHistory}>Clear history</button>
                </div>
              </section>
            )}
            {tab === 'About' && (
              <section className="settings-section about-section">
                <div>
                  <h3>About Aether AI</h3>
                  <p className="muted small">A multi-agent assistant built by Junaid, an AI/ML practitioner and builder of AI tools.</p>
                </div>
                <div>
                  <h4>What it can do</h4>
                  <p>Aether AI can answer general questions, research the web, find images, summarize recent news, check weather, perform calculations, and answer questions grounded in your uploaded PDFs. It also supports speech-to-text and read-aloud responses.</p>
                </div>
                <div>
                  <h4>How it works</h4>
                  <p>A request is first routed by Laya, then a supervisor delegates it to specialist agents. Agents call focused tools when needed, and the frontend streams the response while showing activity.</p>
                  <p className="muted small">The stack uses a React frontend, FastAPI backend, LangGraph supervisor/agents, and a Pinecone-backed retrieval pipeline for PDF knowledge.</p>
                </div>
                <div>
                  <h4>About the builder</h4>
                  <p>Junaid is an AI/ML practitioner who built Aether AI and has created multiple AI tools.</p>
                  <div className="about-links">
                    <a className="markdown-link-card" href="https://github.com/junaidariie" target="_blank" rel="noopener noreferrer">
                      <span className="markdown-link-card-copy"><span className="markdown-link-card-title">GitHub</span><span className="markdown-link-card-domain">github.com/junaidariie</span></span>
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                    <a className="markdown-link-card" href="https://www.instagram.com/junaidariie/" target="_blank" rel="noopener noreferrer">
                      <span className="markdown-link-card-copy"><span className="markdown-link-card-title">Instagram</span><span className="markdown-link-card-domain">instagram.com/junaidariie</span></span>
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </section>
            )}
            {tab === 'Technical' && (
              <section className="settings-section">
                <div>
                  <h3>Technical</h3>
                  <p className="muted small">Backend endpoints and service status.</p>
                </div>
                <dl className="kv tech-list">
                  <dt>Backend URL</dt><dd><code>{API_BASE}</code></dd>
                  <dt>API status</dt><dd><Status ok={tech.api} pending={tech.pending} /></dd>
                  <dt>Chat stream</dt><dd><code>POST {apiUrl(ENDPOINTS.chatStream)}</code></dd>
                  <dt>Speech-to-text</dt><dd><code>POST {ENDPOINTS.stt}</code> <Status ok={tech.stt} pending={tech.pending} /></dd>
                  <dt>Text-to-speech</dt><dd><code>POST {ENDPOINTS.tts}</code> <Status ok={tech.tts} pending={tech.pending} /></dd>
                </dl>
                <button className="btn btn-ghost" onClick={runChecks} disabled={tech.pending}><RefreshCw size={16} /> Check again</button>
                <p className="muted small">Backend memory is held in RAM. After a backend restart, saved chats stay visible here but the assistant no longer remembers them.</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
