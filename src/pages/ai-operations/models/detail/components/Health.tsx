import type { AiModel } from '@/pages/ai-operations/types';
import { MODEL_STATUS, CAPACITY_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Health({ model }: { model: AiModel }) {
  const h = model.healthMeta;
  const status = MODEL_STATUS[h.status];
  const capacity = CAPACITY_STATE[h.capacityState];

  const rows = [
    { label: 'Last check', value: h.lastChecked },
    { label: 'Response health', value: h.responseHealth },
    { label: 'Recent failures', value: h.recentFailures },
    { label: 'Recommended action', value: h.recommendedAction },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Health</h3>
        <StatusPill tone={status.tone} label={status.label} pulse={h.status === 'degraded'} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Capacity</span>
        <StatusPill tone={capacity.tone} label={capacity.label} />
      </div>

      {h.failureSummary && h.failureSummary !== 'No recent failures.' && (
        <div className="mt-3 bg-red-500/10 border border-red-500/25 rounded-md p-3">
          <p className="text-xs text-red-300 leading-relaxed">{h.failureSummary}</p>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right">{r.value}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">No live health checks are run in this demo.</p>
    </section>
  );
}