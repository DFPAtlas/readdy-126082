import { Link } from 'react-router-dom';
import { getCriticalAlerts, getWallboardStatus } from '@/pages/ai-operations/wallboard/selectors';
import UnavailableState from '@/pages/ai-operations/wallboard/components/UnavailableState';
import { SEVERITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function CriticalAlerts() {
  const alerts = getCriticalAlerts(6);
  const status = getWallboardStatus().alerts;

  return (
    <section className="h-full bg-background-100 border border-red-500/20 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Critical Alerts</h3>
        <span className="text-xs font-label text-red-400">{alerts.length} active</span>
      </div>

      {status === 'live' ? (
      <div className="divide-y divide-background-200/40 overflow-y-auto">
        {alerts.map((alert) => {
          const severity = SEVERITY[alert.severity];
          return (
            <div key={alert.id} className="px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{alert.siteName}</span>
                  <StatusPill tone={severity.tone} label={severity.label} />
                  <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{alert.detectedAt}</span>
                </div>
                <p className="text-sm text-foreground-200 mt-1">{alert.message}</p>
                <p className="text-[11px] font-label text-foreground-500 mt-0.5">{alert.state}</p>
              </div>
              {alert.referenceId && (
                <Link
                  to={`/ai-operations/alerts/${alert.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5 hover:bg-amber-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Open
                </Link>
              )}
            </div>
          );
        })}
      </div>
      ) : (
        <UnavailableState label="Alert registry unavailable." />
      )}
    </section>
  );
}