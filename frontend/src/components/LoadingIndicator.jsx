import { PHASE_LABELS } from '../utils/constants';

export default function LoadingIndicator({ phase = 'preparing', label }) {
  const text = label || PHASE_LABELS[phase] || 'Working';
  return (
    <div className="loading-indicator" role="status" aria-live="polite">
      <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="loading-text">{text}…</span>
    </div>
  );
}
