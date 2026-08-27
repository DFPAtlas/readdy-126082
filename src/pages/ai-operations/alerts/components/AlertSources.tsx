import { HEALTH_STATUS } from '@/pages/ai-operations/constants';
import { demoAlertSources } from '@/pages/ai-operations/alerts/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AlertSources() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Alert Sources</h3>
        <span className="text-[11px] font-label text-foreground-600">Demo source health</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-background-200/40">
        {demoAlertSources.map((s) => {
          const status = HEALTH_STATUS[s.status];
          return (
            <div key={s.source} className="bg-background-100 p-4 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{s.source}</span>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-label text-foreground-500">
                <span>{s.alertsToday} today</span>
                <span className="whitespace-nowrap">{s.lastAlert.replace('2026-08-25 ', '')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}