import { Link } from 'react-router-dom';
import { demoPolicyExceptions } from '@/mocks/ai-operations-security';
import { EXCEPTION_STATUS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function isExpiring(expiry: string): boolean {
  // Demo heuristic: flag exceptions expiring within 3 days of 2026-08-25.
  const target = expiry;
  return target >= '2026-08-26' && target <= '2026-08-28';
}

export default function ActiveExceptions() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Active Exceptions</h3>
          <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-flask-line text-xs w-3 h-3 flex items-center justify-center"></i>
            Demo
          </span>
        </div>
        <span className="text-[11px] font-label text-foreground-600">{demoPolicyExceptions.length} exceptions</span>
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Exception</th>
              <th className="px-4 py-2.5 font-medium">Policy</th>
              <th className="px-4 py-2.5 font-medium">Scope</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 font-medium">Expiry</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {demoPolicyExceptions.map((e) => {
              const status = EXCEPTION_STATUS[e.status];
              const risk = RISK_LEVEL[e.risk];
              const expiring = isExpiring(e.expiry);
              return (
                <tr key={e.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono text-xs text-foreground-300">{e.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/security/policies/${e.policyId}`} className="text-foreground-200 hover:text-accent-400 transition-colors cursor-pointer">
                      {e.policyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.scope}</td>
                  <td className="px-4 py-3 text-foreground-400">{e.reason}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-label ${expiring ? 'text-amber-300' : 'text-foreground-300'}`}>
                      {expiring && <i className="ri-timer-flash-line text-sm w-4 h-4 flex items-center justify-center"></i>}
                      {e.expiry}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden divide-y divide-background-200/40">
        {demoPolicyExceptions.map((e) => {
          const status = EXCEPTION_STATUS[e.status];
          const expiring = isExpiring(e.expiry);
          return (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">{e.reason}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{e.scope} · {e.id}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-label text-foreground-500 flex-wrap">
                {expiring && <span className="text-amber-300">Expiring soon</span>}
                <span>Expiry {e.expiry}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}