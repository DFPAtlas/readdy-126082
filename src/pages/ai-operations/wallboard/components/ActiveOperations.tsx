import { Link } from 'react-router-dom';
import { getActiveOperations, getWallboardStatus } from '@/pages/ai-operations/wallboard/selectors';
import UnavailableState from '@/pages/ai-operations/wallboard/components/UnavailableState';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ActiveOperations() {
  const items = getActiveOperations();
  const status = getWallboardStatus().operations;

  return (
    <section className="h-full bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Active Operations</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-400"></span>
          {items.length} active
        </span>
      </div>

      {status === 'live' ? (
      <div className="divide-y divide-background-200/40 overflow-y-auto">
        {items.map((item) => {
          const risk = RISK_LEVEL[item.risk as keyof typeof RISK_LEVEL];
          return (
            <div key={`${item.kind}-${item.refId}`} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{item.site}</span>
                  <span className="text-foreground-600">&middot;</span>
                  <span className="text-xs text-foreground-400 whitespace-nowrap">{item.agent}</span>
                </div>
                <p className="text-sm text-foreground-200 mt-0.5 line-clamp-1">{item.task}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 max-w-[220px]">
                    <div className="flex items-center justify-between text-[10px] font-label text-foreground-600 mb-1">
                      <span className="truncate">{item.currentStep}</span>
                      <span className="whitespace-nowrap">{item.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-500 rounded-full transition-all duration-500" style={{ width: `${item.progress}%` }}></div>
                    </div>
                  </div>
                  <StatusPill tone={risk.tone} label={risk.label} />
                </div>
              </div>
              <Link
                to={`/ai-operations/runs/${item.refId}`}
                className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
              >
                Open
              </Link>
            </div>
          );
        })}
      </div>
      ) : (
        <UnavailableState label="Run registry unavailable." />
      )}
    </section>
  );
}