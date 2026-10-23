import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Activity, Loader2, CheckCircle2, XCircle, Info, Sparkles } from 'lucide-react';
import RoutingDetails from './RoutingDetails';
import AgentActivity from './AgentActivity';
import ToolActivity from './ToolActivity';
import { agentLabel, toolMeta } from '../utils/formatters';

export default function ActivityPanel({ activity, streaming, status }) {
  const [open, setOpen] = useState(streaming);
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setOpen(streaming); }, [streaming]);

  const failed = status === 'error';
  const stopped = status === 'stopped';
  const Icon = streaming ? Loader2 : failed || stopped ? XCircle : CheckCircle2;
  const phase = failed
    ? activity.failedPhase || 'routing'
    : stopped
      ? activity.stoppedPhase || 'routing'
      : activity.phase || 'routing';
  const stage = phase === 'routing' || phase === 'preparing'
    ? 'Routing'
    : phase === 'supervisor'
      ? 'Reviewing'
      : phase === 'agent'
        ? 'Specialist'
        : phase === 'tool'
          ? 'Tools'
          : 'Response';
  const stageIndex = phase === 'routing' || phase === 'preparing'
    ? 0
    : phase === 'supervisor'
      ? 1
      : phase === 'agent'
        ? 2
        : phase === 'tool'
          ? 3
          : 4;
  const activeAgent = [...activity.timeline].reverse().find((item) => item.kind === 'agent' && item.status === 'working');
  const activeTool = [...activity.timeline].reverse().find((item) => item.kind === 'tool' && item.status === 'running');
  const phaseText = failed
    ? 'The request stopped with an error'
    : stopped
      ? 'Generation was stopped'
      : !streaming
        ? 'Request complete'
        : phase === 'routing' || phase === 'preparing'
          ? 'Choosing the best model for your request'
          : phase === 'supervisor'
            ? 'The supervisor is planning the next step'
            : phase === 'agent'
              ? `${activeAgent ? agentLabel(activeAgent.name) : 'A specialist'} is working on your request`
              : phase === 'tool'
                ? `${activeTool ? toolMeta(activeTool.name).label : 'A tool'} is gathering results`
                : 'Preparing your response';
  const agentCount = activity.timeline.filter((t) => t.kind === 'agent').length;
  const toolCount = activity.timeline.filter((t) => t.kind === 'tool').length;
  const stages = ['Route', 'Plan', 'Agent', 'Tools', 'Answer'];
  const statusText = streaming ? 'In progress' : failed ? 'Needs attention' : stopped ? 'Stopped' : 'Complete';

  return (
    <section className="activity" aria-label="Thinking and activity">
      <div className={`activity-overview ${failed ? 'failed' : stopped ? 'stopped' : ''}`}>
        <button className="activity-head" aria-expanded={open} onClick={() => { touched.current = true; setOpen((v) => !v); }}>
          <span className={`activity-icon ${streaming ? 'working' : failed ? 'failed' : 'complete'}`}>
            {streaming ? <Loader2 size={17} className="spin" aria-hidden="true" /> : failed ? <XCircle size={17} aria-hidden="true" /> : <Activity size={17} aria-hidden="true" />}
          </span>
          <span className="activity-heading">
            <span className="activity-title">Thinking &amp; activity</span>
            <span className="activity-current">{phaseText}</span>
          </span>
          <span className={`activity-badge ${streaming ? 'working' : failed ? 'failed' : stopped ? 'stopped' : 'complete'}`}>
            <Icon size={13} className={streaming ? 'spin' : ''} aria-hidden="true" /> {statusText}
          </span>
          <ChevronDown size={17} className={`activity-chevron ${open ? 'flip' : ''}`} aria-hidden="true" />
        </button>
        <div className="activity-progress" aria-label={`Current stage: ${stage}`}>
          {stages.map((label, index) => {
            const optionalStage = (index === 2 && agentCount === 0) || (index === 3 && toolCount === 0);
            const complete = !optionalStage && (
              index === 0
                ? activity.routingStatus === 'done'
                : index === 1
                  ? stageIndex > index
                  : index === 2
                    ? agentCount > 0 && stageIndex > index
                    : index === 3
                      ? toolCount > 0 && stageIndex > index
                      : !streaming
            );
            const current = streaming && index === stageIndex;
            return (
              <span key={label} className={`activity-step ${complete ? 'complete' : ''} ${current ? 'current' : ''} ${optionalStage ? 'optional' : ''} ${failed && index === stageIndex ? 'failed' : ''} ${stopped && index === stageIndex ? 'stopped' : ''}`}>
                <span className="activity-step-dot">{complete ? <CheckCircle2 size={12} aria-hidden="true" /> : current ? <Sparkles size={11} aria-hidden="true" /> : null}</span>
                <span className="activity-step-label">{label}</span>
              </span>
            );
          })}
        </div>
        {!streaming && (agentCount > 0 || toolCount > 0) && (
          <div className="activity-counts">
            {agentCount > 0 && <span>{agentCount} specialist{agentCount === 1 ? '' : 's'}</span>}
            {toolCount > 0 && <span>{toolCount} tool{toolCount === 1 ? '' : 's'}</span>}
          </div>
        )}
      </div>
      {open && (
        <div className="activity-body">
          <div className="activity-section-heading"><span>Request progress</span>{streaming && <span className="activity-live"><i /> Live</span>}</div>
          <RoutingDetails routing={activity.routing} status={activity.routingStatus} />
          {activity.timeline.some((t) => t.kind !== 'status') && <div className="activity-events">
            {activity.timeline.map((t, i) => {
              if (t.kind === 'status') return <div className="act-status-line" key={i}><Info size={14} aria-hidden="true" /> {t.text}</div>;
              if (t.kind === 'agent') return <AgentActivity key={`a${i}`} entry={t} />;
              return <ToolActivity key={`t${i}`} entry={t} />;
            })}
          </div>}
        </div>
      )}
    </section>
  );
}
