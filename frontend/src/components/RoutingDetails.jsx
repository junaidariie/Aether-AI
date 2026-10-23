import { useState } from 'react';
import { Route, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';

export default function RoutingDetails({ routing, status }) {
  const [open, setOpen] = useState(false);
  const label = status === 'done' ? 'Routing complete' : status === 'error' ? 'Routing failed' : 'Routing in progress';
  const Icon = status === 'done' ? CheckCircle2 : status === 'error' ? XCircle : Loader2;

  return (
    <div className={`act-card routing ${status}`}>
      <div className="act-row">
        <span className="act-icon"><Route size={15} aria-hidden="true" /></span>
        <div className="act-copy"><strong>Model selection</strong><span>{routing ? `${routing.task || 'General'} request` : 'Classifying your request'}</span></div>
        <span className={`act-status ${status}`}><Icon size={14} className={status === 'pending' ? 'spin' : ''} aria-hidden="true" /> {label}</span>
      </div>
      {routing && (
        <dl className="kv">
          <dt>Selected model</dt><dd><code>{routing.model || 'Unknown'}</code></dd>
        </dl>
      )}
      {routing && (routing.confidence != null || routing.reason) && (
        <>
          <button className="link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide routing details' : 'Why this model?'} <ChevronDown size={14} className={open ? 'flip' : ''} aria-hidden="true" />
          </button>
          {open && (
            <dl className="kv tech">
              {routing.confidence != null && <><dt>Confidence</dt><dd>{routing.confidence}</dd></>}
              {routing.reason && <><dt>Reason</dt><dd>{routing.reason}</dd></>}
            </dl>
          )}
        </>
      )}
    </div>
  );
}
