import { getWallboardSystemHealth } from '@/pages/ai-operations/wallboard/selectors';
import { HEALTH_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function SystemHealth() {
  const rows = getWallboardSystemHealth();

  return (
    <section className="h-full bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">System Health</h3>
      </div>

      <div className="divide-y divide-background-200/40 overflow-y-auto">
        {rows.map((row) => {
          const display = HEALTH_STATUS[row.status];
          return (
            <div key={row.key} className="px-4 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground-200 whitespace-nowrap">{row.label}</p>
                {row.detail && <p className="text-[10px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">{row.detail}</p>}
              </div>
              <StatusPill tone={display.tone} label={display.label} />
            </div>
          );
        })}
      </div>
    </section>
  );
}