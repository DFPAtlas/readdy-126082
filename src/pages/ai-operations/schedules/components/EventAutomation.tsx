import { Link } from 'react-router-dom';
import type { EventAutomationRule } from '@/pages/ai-operations/types';
import { SCHEDULE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function EventAutomation({ rules }: { rules: EventAutomationRule[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Event Automation</h3>
        <span className="text-[11px] font-label text-foreground-600">no event listener executes</span>
      </div>

      <div className="divide-y divide-background-200/40">
        {rules.map((r) => {
          const status = SCHEDULE_STATUS[r.status];
          return (
            <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground-100">{r.name}</span>
                  <span className="font-mono text-[10px] text-accent-400">{r.id}</span>
                </div>
                <p className="text-xs text-foreground-400 mt-1">
                  <span className="text-foreground-500">Source:</span> {r.eventSource} · <span className="text-foreground-500">Condition:</span> {r.condition}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Link to={`/ai-operations/agents/${r.agentId}`} className="text-xs font-label text-foreground-300 hover:text-accent-400 transition-colors cursor-pointer">
                    {r.agentName}
                  </Link>
                  <span className="text-foreground-600">→</span>
                  <span className="text-xs text-foreground-400">{r.resultingTask}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.approvalRequired && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
                    <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
                    Approval
                  </span>
                )}
                <StatusPill tone={status.tone} label={status.label} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}