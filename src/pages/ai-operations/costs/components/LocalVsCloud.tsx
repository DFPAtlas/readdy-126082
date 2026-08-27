import { getLocalCloud } from '@/pages/ai-operations/costs/selectors';

export default function LocalVsCloud() {
  const rows = getLocalCloud();

  return (
    <section aria-label="Local vs cloud" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Local vs Cloud</h3>
        <span className="text-[11px] font-label text-foreground-500">Models Registry metadata</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((r) => (
          <div
            key={r.scope}
            className={`p-4 rounded-lg border ${
              r.scope === 'local' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-accent-500/5 border-accent-500/20'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-label font-semibold text-foreground-100">{r.label}</p>
              <span className={`text-xs font-label px-2 py-0.5 rounded-full ${r.scope === 'local' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-accent-500/15 text-accent-400'}`}>
                {r.scope === 'local' ? 'On-premise' : 'External'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-foreground-500">Jobs</span>
              <span className="text-foreground-100 text-right">{r.jobs}</span>
              <span className="text-foreground-500">Avg duration</span>
              <span className="text-foreground-100 text-right">{r.avgDuration}</span>
              <span className="text-foreground-500">Estimated cost</span>
              <span className="text-foreground-100 text-right">{r.estimatedCost}</span>
              <span className="text-foreground-500">Failure rate</span>
              <span className="text-foreground-100 text-right">{r.failureRate}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}