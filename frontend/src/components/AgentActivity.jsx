import { Loader2, CheckCircle2, XCircle, Clock, Bot } from 'lucide-react';
import { agentLabel } from '../utils/formatters';

const STATUS = {
  waiting: { text: 'Waiting', Icon: Clock },
  working: { text: 'Working', Icon: Loader2 },
  completed: { text: 'Completed', Icon: CheckCircle2 },
  failed: { text: 'Failed', Icon: XCircle },
};

export default function AgentActivity({ entry }) {
  const s = STATUS[entry.status] || STATUS.working;
  return (
    <div className={`act-card agent ${entry.status}`}>
      <div className="act-row">
        <span className="act-icon"><Bot size={15} aria-hidden="true" /></span>
        <div className="act-copy"><strong>{agentLabel(entry.name)}</strong><span>Specialist agent</span></div>
        <span className={`act-status ${entry.status}`}>
          <s.Icon size={14} className={entry.status === 'working' ? 'spin' : ''} aria-hidden="true" /> {s.text}
        </span>
      </div>
    </div>
  );
}
