import { getUsersOnline, type PresenceSource } from '@/pages/ai-operations/wallboard/selectors';
import UnavailableState from '@/pages/ai-operations/wallboard/components/UnavailableState';

const SOURCE_META: Record<PresenceSource, { label: string; className: string }> = {
  live: {
    label: 'LIVE',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
  partial: {
    label: 'PARTIAL',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  not_connected: {
    label: 'NOT CONNECTED',
    className: 'text-foreground-500 bg-background-200/50 border-background-200/60',
  },
};

export default function UsersOnline() {
  const data = getUsersOnline();
  const meta = SOURCE_META[data.source];
  const connected = data.source !== 'not_connected';

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Online Now</h3>
        <span className={`inline-flex items-center gap-1 text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      {connected ? (
        <div className="px-4 py-3">
          <div className="flex items-baseline gap-1.5">
            <p className="text-3xl font-heading font-bold text-foreground-100 tabular-nums">{data.total}</p>
            <span className="text-[11px] font-label text-foreground-500">online now</span>
          </div>
          <p className="text-[10px] font-label text-foreground-600 mt-0.5">Anonymous visitors active in last 5 min</p>

          <div className="mt-3 space-y-1.5 text-sm">
            {data.sites.map((s) => (
              <div key={s.siteKey} className="flex items-center justify-between">
                <span className="text-foreground-400">{s.site}</span>
                {s.count === null ? (
                  <span className="text-[11px] font-label text-foreground-600">Not connected</span>
                ) : (
                  <span className="text-foreground-200 font-medium tabular-nums">{s.count}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <UnavailableState label="No live online-visitor analytics are connected to the site registry." />
          {data.sites.length > 0 && (
            <div className="px-4 pb-3 space-y-1.5 text-sm border-t border-background-200/60">
              {data.sites.map((s) => (
                <div key={s.siteKey} className="flex items-center justify-between">
                  <span className="text-foreground-400">{s.site}</span>
                  <span className="text-[11px] font-label text-foreground-600">Not connected</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}