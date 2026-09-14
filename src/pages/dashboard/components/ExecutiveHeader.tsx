import type { PortfolioHealthState, ExecHeaderMetric } from '../executiveTypes';
import { PORTFOLIO_HEALTH_LABELS, PORTFOLIO_HEALTH_STYLES } from '../executiveTypes';

const HEALTH_TONE: Record<PortfolioHealthState, string> = {
  HEALTHY: 'text-emerald-400',
  ATTENTION: 'text-amber-400',
  CRITICAL: 'text-red-400',
  UNKNOWN: 'text-foreground-400',
};

export default function ExecutiveHeader({
  health,
  metrics,
}: {
  health: PortfolioHealthState;
  metrics: ExecHeaderMetric[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50 leading-tight">DFP Command</h1>
          <p className="text-sm text-foreground-500 mt-0.5">Digital Footprint Operations — executive control room.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">
            Portfolio Health
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-label font-semibold whitespace-nowrap ${PORTFOLIO_HEALTH_STYLES[health]}`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${HEALTH_TONE[health]} bg-current`}></span>
            {PORTFOLIO_HEALTH_LABELS[health]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {metrics.map((m) => (
          <div
            key={m.key}
            className="bg-background-100 border border-background-200/60 rounded-lg p-3 min-w-0 hover:border-background-300/60 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className={`${m.icon} ${m.accent} w-3.5 h-3.5 flex items-center justify-center rounded`}></i>
              <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide truncate whitespace-nowrap">
                {m.label}
              </span>
            </div>
            <p className="text-lg font-heading font-bold leading-none text-foreground-50 truncate">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}