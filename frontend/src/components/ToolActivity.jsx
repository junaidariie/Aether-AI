import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronDown, Wrench, AlertTriangle } from 'lucide-react';
import { CATEGORY_LABELS } from '../utils/constants';
import { toolMeta } from '../utils/formatters';
import { linkify, parseKeyValues, looksLikeToolFailure } from '../utils/parseToolResults';

function Output({ category, text }) {
  const rows = category === 'weather' ? parseKeyValues(text) : null;
  if (rows) {
    return <dl className="kv weather">{rows.map(([k, v]) => (<span className="kv-row" key={k}><dt>{k}</dt><dd>{v}</dd></span>))}</dl>;
  }
  return (
    <pre className="tool-output">
      {linkify(text).map((p, i) => p.url
        ? <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">{p.text}</a>
        : <span key={i}>{p.text}</span>)}
    </pre>
  );
}

export default function ToolActivity({ entry }) {
  const [open, setOpen] = useState(false);
  const { label, category } = toolMeta(entry.name);
  const hasOutput = entry.output != null;
  const problem = hasOutput && looksLikeToolFailure(entry.output);
  const status = entry.status;
  const Icon = status === 'running' ? Loader2 : status === 'failed' ? XCircle : CheckCircle2;
  const statusText = status === 'running' ? 'Running' : status === 'failed' ? 'Issue' : 'Done';

  return (
    <div className={`act-card tool ${status}`}>
      <div className="act-row">
        <span className="act-icon"><Wrench size={15} aria-hidden="true" /></span>
        <div className="act-copy"><strong>{label}</strong><span>{CATEGORY_LABELS[category]}</span></div>
        <span className={`act-status ${status}`}><Icon size={14} className={status === 'running' ? 'spin' : ''} aria-hidden="true" /> {statusText}</span>
      </div>
      {(hasOutput || problem) && (
        <button className="link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide results' : hasOutput ? 'View results' : 'View details'} <ChevronDown size={14} className={open ? 'flip' : ''} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="tool-details">
          {problem && <span className="act-warning"><AlertTriangle size={13} aria-hidden="true" /> The tool reported a problem</span>}
          <p className="muted small"><code>{entry.name}</code></p>
          {hasOutput ? <Output category={category} text={entry.output} /> : <p className="muted small">No output has been returned yet.</p>}
        </div>
      )}
    </div>
  );
}
