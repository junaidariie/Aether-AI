import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, MessageSquare, MoreVertical, Pencil, Trash2, Pin, PinOff, Settings, X, MapPin, Loader2 } from 'lucide-react';
import logo from '../assets/logo.svg';
import ProfileMenu from './ProfileMenu';

function ConversationItem({ conv, active, onSelect, onRename, onDelete, onTogglePin }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(conv.title);
  const ref = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  const commit = (e) => { e?.preventDefault(); onRename(conv.id, value); setEditing(false); };

  return (
    <li className={`conv ${active ? 'active' : ''}`} ref={ref}>
      {editing ? (
        <form className="conv-edit" onSubmit={commit}>
          <input className="field" autoFocus value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} onBlur={commit} aria-label="Conversation title" />
        </form>
      ) : (
        <button className="conv-main" onClick={() => onSelect(conv.id)} aria-current={active ? 'true' : undefined} title={conv.title}>
          {conv.pinned ? <Pin size={14} aria-label="Pinned" /> : <MessageSquare size={14} aria-hidden="true" />}
          <span className="conv-title">{conv.title}</span>
        </button>
      )}
      {!editing && (
        <button className="icon-btn conv-more" aria-label={`Options for ${conv.title}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <MoreVertical size={16} />
        </button>
      )}
      {menu && (
        <div className="popover conv-menu" role="menu">
          <button role="menuitem" className="menu-item" onClick={() => { setMenu(false); setValue(conv.title); setEditing(true); }}><Pencil size={15} /> Rename</button>
          <button role="menuitem" className="menu-item" onClick={() => { setMenu(false); onTogglePin(conv.id); }}>
            {conv.pinned ? <><PinOff size={15} /> Unpin</> : <><Pin size={15} /> Pin</>}
          </button>
          <button role="menuitem" className="menu-item danger" onClick={() => { setMenu(false); onDelete(conv.id); }}><Trash2 size={15} /> Delete</button>
        </div>
      )}
    </li>
  );
}

export default function Sidebar({ conversations, activeId, collapsed, mobileOpen, profile, onNew, onSelect, onRename, onDelete, onTogglePin, onCloseMobile, onOpenSettings, onRenameProfile, onClearHistory, onResetProfile }) {
  const [profileMenu, setProfileMenu] = useState(false);
  const [location, setLocation] = useState('');
  const [locationStatus, setLocationStatus] = useState('loading');
  const list = conversations
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  const initial = (profile.name || 'G').trim().charAt(0).toUpperCase();

  const loadLocation = useCallback(async (signal) => {
    try {
      const response = await fetch('https://ipapi.co/json/', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error(`Location lookup failed (${response.status}).`);
      const data = await response.json();
      if (data.error) throw new Error(data.reason || 'Location lookup is unavailable.');
      const details = [data.city, data.region, data.country_name]
        .filter((part, index, parts) => typeof part === 'string' && part && parts.indexOf(part) === index);
      if (!details.length) throw new Error('The provider did not return a location.');
      setLocation(details.join(', '));
      setLocationStatus('ready');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setLocationStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    loadLocation(controller.signal).finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadLocation]);

  return (
    <>
      {mobileOpen && <div className="backdrop" onClick={onCloseMobile} aria-hidden="true" />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`} aria-label="Conversations">
        <div className="sidebar-head">
          <div className="brand">
            <img src={logo} alt="" width="28" height="28" />
            {!collapsed && <span className="brand-name">Aether AI</span>}
          </div>
          <button className="icon-btn mobile-only" onClick={onCloseMobile} aria-label="Close sidebar"><X size={20} /></button>
        </div>

        <button className="new-chat" onClick={onNew} aria-label="New chat">
          <Plus size={20} />{!collapsed && <span>New chat</span>}
        </button>

        {!collapsed && (
          <nav className="conv-nav" aria-label="Recent conversations">
            <h2 className="section-label">Recent</h2>
            {list.length === 0 ? (
              <p className="muted small pad">Your conversations will appear here. They are saved only in this browser.</p>
            ) : (
              <ul className="conv-list">
                {list.map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} onRename={onRename} onDelete={onDelete} onTogglePin={onTogglePin} />
                ))}
              </ul>
            )}
          </nav>
        )}

        <div className="sidebar-foot">
          <div className="sidebar-foot-content">
            <div className="sidebar-foot-row">
              <div className="profile-wrap">
                <button className="profile-btn" onClick={() => setProfileMenu((v) => !v)} aria-haspopup="menu" aria-expanded={profileMenu} aria-label="Profile menu">
                  <span className="avatar">{initial}</span>
                  {!collapsed && <span className="profile-name">{profile.name || 'Guest'}</span>}
                </button>
                {profileMenu && (
                  <ProfileMenu name={profile.name} onRename={onRenameProfile} onSettings={onOpenSettings} onClearHistory={onClearHistory} onResetProfile={onResetProfile} onClose={() => setProfileMenu(false)} />
                )}
              </div>
              {!collapsed && <button className="icon-btn" onClick={onOpenSettings} aria-label="Settings"><Settings size={20} /></button>}
            </div>
            {!collapsed && (
              <div className="sidebar-location" role="status" title="Approximate location based on your public IP address">
                <MapPin size={14} aria-hidden="true" />
                {locationStatus === 'loading'
                  ? <><Loader2 size={13} className="spin" aria-hidden="true" /><span>Finding location…</span></>
                  : <span>{locationStatus === 'ready' ? location : 'Location unavailable'}</span>}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
