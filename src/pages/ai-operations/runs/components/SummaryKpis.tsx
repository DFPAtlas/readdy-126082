import { useMemo } from 'react';
import type { AiTaskRun } from '@/pages/ai-operations/types';

interface SummaryKpisProps {
  runs: AiTaskRun[];
}

export default function SummaryKpis({ runs }: SummaryKpisProps) {
  const kpis = useMemo(() => {
    const count = (statuses: string[]) => runs.filter((r) => statuses.includes(r.status)).length;

    let costTotal = 0;
    for (const r of runs) {
      if (r.status === 'working' || r.status === 'completed') {
        const n = Number((r.actualCost || '').replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(n)) costTotal += n;
      }
    }

    return [
      { key: 'running', label: 'Running Now', value: count(['working']), icon: 'ri-loader-4-line', accent: 'bg-accent-500/15 text-accent-400' },
      { key: 'queued', label: 'Queued', value: count(['queued', 'waiting']), icon: 'ri-time-line', accent: 'bg-secondary-500/15 text-secondary-300' },
      { key: 'approval', label: 'Awaiting Approval', value: count(['awaiting_approval']), icon: 'ri-shield-check-line', accent: 'bg-amber-500/15 text-amber-400' },
      { key: 'completed', label: 'Completed Today', value: count(['completed']), icon: 'ri-check-double-line', accent: 'bg-emerald-500/15 text-emerald-400' },
      { key: 'failed', label: 'Failed Today', value: count(['failed']), icon: 'ri-error-warning-line', accent: 'bg-red-500/15 text-red-400' },
      { key: 'blocked', label: 'Blocked', value: count(['blocked']), icon: 'ri-stop-circle-line', accent: 'bg-red-500/15 text-red-400' },
      { key: 'retry', label: 'Retry Scheduled', value: count(['retry_scheduled']), icon: 'ri-restart-line', accent: 'bg-amber-500/15 text-amber-400' },
      { key: 'cost', label: 'Estimated AI Cost Today', value: `£${costTotal.toFixed(2)}`, icon: 'ri-money-pound-circle-line', accent: 'bg-secondary-500/15 text-secondary-300' },
    ];
  }, [runs]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {kpis.map((k) => (
        <div key={k.key} className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${k.accent}`}>
            <i className={`${k.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
          </div>
          <p className="text-2xl font-heading font-bold text-foreground-50 mt-2.5 whitespace-nowrap">{k.value}</p>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5 leading-tight">{k.label}</p>
        </div>
      ))}
    </div>
  );
}