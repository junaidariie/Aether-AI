import { useEffect, useRef, useState } from 'react';
import { Settings, Pencil, Trash2, RotateCcw, Check } from 'lucide-react';

export default function ProfileMenu({ name, onRename, onSettings, onClearHistory, onResetProfile, onClose }) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const save = (e) => { e.preventDefault(); onRename(value.trim()); setEditing(false); };

  return (
    <div className="popover profile-menu" ref={ref} role="menu" aria-label="Profile menu">
      <div className="profile-menu-name">{name || 'Guest'}</div>
      {editing ? (
        <form className="inline-form" onSubmit={save}>
          <input className="field" autoFocus value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} aria-label="Display name" />
          <button className="icon-btn" type="submit" aria-label="Save name"><Check size={16} /></button>
        </form>
      ) : (
        <button role="menuitem" className="menu-item" onClick={() => setEditing(true)}><Pencil size={16} /> Edit display name</button>
      )}
      <button role="menuitem" className="menu-item" onClick={() => { onClose(); onSettings(); }}><Settings size={16} /> Settings</button>
      <button role="menuitem" className="menu-item" onClick={() => { onClose(); onClearHistory(); }}><Trash2 size={16} /> Clear local history</button>
      <button role="menuitem" className="menu-item danger" onClick={() => { onClose(); onResetProfile(); }}><RotateCcw size={16} /> Reset local profile</button>
    </div>
  );
}
