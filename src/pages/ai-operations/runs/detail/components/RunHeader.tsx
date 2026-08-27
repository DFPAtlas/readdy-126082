import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AiTaskRun } from '@/pages/ai-operations/types';
import { RUN_STATUS, RUN_PRIORITY, RISK_LEVEL, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface RunHeaderProps {
  run: AiTaskRun;
  liveMode: boolean;
}

export default function RunHeader({ run, liveMode }: RunHeaderProps) {
  const [notice, setNotice] = useState('');

  const act = () => {
    // In live mode these are runtime controls that are intentionally disabled —
    // no real process is paused/cancelled/retried. In demo mode they remain
    // local-state-only simulations.
    setNotice('Agent runtime is not connected — production run control unavailable.');
  };

  const status = RUN_STATUS[run.status];
  const priority = RUN_PRIORITY[run.priority];
  const risk = RISK_LEVEL[run.risk];

  const btn =
    'inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-50 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-foreground-200 disabled:hover:border-background-200/60';

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-foreground-600 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap">AI Operations</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <Link to="/ai-operations/runs" className="hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap">Tasks &amp; Runs</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <span className="text-foreground-300 font-mono whitespace-nowrap">{run.id}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{run.taskName}</h1>
            <span className="font-mono text-xs text-accent-400 bg-background-100 border border-background-200/60 rounded-md px-2 py-0.5 whitespace-nowrap">{run.id}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusPill tone={status.tone} label={status.label} pulse={run.status === 'working'} />
            <StatusPill tone={priority.tone} label={`${priority.label} priority`} />
            <StatusPill tone={risk.tone} label={`${risk.label} risk`} />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              {ENVIRONMENT_LABELS[run.environment]}
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-2 max-w-2xl">{run.siteName} · {run.agentName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => act()}
            disabled={liveMode || run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled'}
            className={btn}
          >
            <i className="ri-pause-line text-sm w-4 h-4 flex items-center justify-center"></i>Pause
          </button>
          <button onClick={() => act()} disabled={liveMode || run.status === 'completed' || run.status === 'cancelled'} className={btn}>
            <i className="ri-close-line text-sm w-4 h-4 flex items-center justify-center"></i>Cancel
          </button>
          <button onClick={() => act()} disabled={liveMode} className={btn}>
            <i className="ri-restart-line text-sm w-4 h-4 flex items-center justify-center"></i>Retry
          </button>
          <button
            onClick={() => act()}
            disabled={liveMode}
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent-500"
          >
            <i className="ri-shield-check-line text-sm w-4 h-4 flex items-center justify-center"></i>Request Review
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 flex items-start gap-2">
          <i className="ri-information-line text-amber-400 w-4 h-4 flex items-center justify-center mt-0.5"></i>
          <p className="text-sm text-amber-300">{notice}</p>
        </div>
      )}
    </div>
  );
}