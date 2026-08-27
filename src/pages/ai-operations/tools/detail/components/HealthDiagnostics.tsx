import type { ToolConnection } from '@/pages/ai-operations/types';
import { CONNECTION_HEALTH } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function HealthDiagnostics({ connection }: { connection: ToolConnection }) {
  const { health } = connection;
  const state = CONNECTION_HEALTH[health.state];

  const rows: { label: string; value: string }[] = [
    { label: 'Last successful check', value: health.lastSuccessfulCheck },
    { label: 'Last failure', value: health.lastFailure },
    { label: 'Failure summary', value: health.failureSummary },
    { label: 'Response time', value: health.responseTime },
    { label: 'Availability', value: health.availability },
    { label: 'Recommended action', value: health.recommendedAction },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Health &amp; Diagnostics</h3>
        <StatusPill tone={state.tone} label={state.label} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] font-label text-foreground-600 mt-3">No live health checks are run — this is safe demo metadata only.</p>
    </section>
  );
}