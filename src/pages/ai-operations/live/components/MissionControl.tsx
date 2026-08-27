import { Link } from 'react-router-dom';
import { getMissionControl } from '@/pages/ai-operations/live/selectors';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function MissionControl() {
  const items = getMissionControl();

  return (
    <section className="bg-background-100 border border-accent-500/20 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Mission Control</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse"></span>
          {items.length} active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
        {items.map((item) => {
          const risk = RISK_LEVEL[item.risk];
          const pct = item.totalSteps > 0 ? Math.round((item.currentStep / item.totalSteps) * 100) : 0;
          return (
            <div key={item.runId} className="bg-background-50 border border-background-200/40 rounded-lg p-3.5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-200">{item.siteName}</p>
                  <p className="text-[11px] text-foreground-500 mt-0.5">{item.agentName}</p>
                </div>
                <StatusPill tone={risk.tone} label={risk.label} />
              </div>

              <p className="text-sm text-foreground-300 mt-2.5 line-clamp-2">{item.task}</p>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-label text-foreground-600 mb-1">
                  <span className="truncate">{item.stepName}</span>
                  <span className="whitespace-nowrap">Step {item.currentStep} / {item.totalSteps}</span>
                </div>
                <div className="h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-label text-foreground-600">{item.runId}</span>
                <Link
                  to={`/ai-operations/runs/${item.runId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  Open Run
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}