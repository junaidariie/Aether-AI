import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import logo from '../assets/logo.svg';

export default function ProfileSetup({ theme, onThemeChange, onContinue, onSkip }) {
  const [name, setName] = useState('');
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = (e) => { e.preventDefault(); if (name.trim()) onContinue(name.trim()); };

  return (
    <div className="modal-backdrop">
      <form className="modal setup" role="dialog" aria-modal="true" aria-labelledby="setup-title" onSubmit={submit}>
        <img src={logo} alt="" className="setup-logo" />
        <h2 id="setup-title">What should I call you?</h2>
        <p className="muted">This stays on this device. There is no account or sign-in.</p>
        <input ref={ref} className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Preferred display name" />
        <div className="seg" role="radiogroup" aria-label="Theme">
          {[['dark', Moon, 'Dark'], ['light', Sun, 'Light']].map(([v, Icon, label]) => (
            <button type="button" key={v} role="radio" aria-checked={theme === v} className={theme === v ? 'on' : ''} onClick={() => onThemeChange(v)}>
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>Skip for now</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Continue</button>
        </div>
      </form>
    </div>
  );
}
